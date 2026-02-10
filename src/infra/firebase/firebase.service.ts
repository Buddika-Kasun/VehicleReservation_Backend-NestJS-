import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseConfigService } from 'src/config/firebase.config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App;

  constructor(private readonly firebaseConfig: FirebaseConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const serviceAccount = this.firebaseConfig.getServiceAccount();
      
      if (admin.apps.length === 0) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });
        this.logger.log('🔥 Firebase Admin SDK initialized successfully');
      } else {
        this.firebaseApp = admin.app();
      }
    } catch (error) {
      this.logger.error(`Failed to initialize Firebase: ${error.message}`);
      this.logger.warn('Push notifications will be disabled');
    }
  }

  async sendPushNotification(
    token: string, 
    title: string, 
    body: string, 
    data?: any
  ): Promise<void> {
    if (!this.firebaseApp) {
      this.logger.warn('Push notification skipped: Firebase not initialized');
      return;
    }

    const message: admin.messaging.Message = {
      token,
      notification: { title, body },
      data: data ? this.sanitizeData(data) : {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'high_importance_channel',
          sound: 'default',
          icon: 'ic_notification',
          color: '#FF6B35',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
        },
        //fcmOptions: {
        //  link: 'https://yourapp.com/notifications',
        //},
      },
    };

    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`✅ Push notification sent successfully: ${response}`);
      console.log(`✅ Push notification sent successfully: ${response}`);
      
      // Log token (first 10 chars for privacy)
      this.logger.debug(`Token used: ${token.substring(0, 10)}...`);
      console.log(`Token used: ${token.substring(0, 10)}...`);
    } catch (error) {
      this.logger.error(`❌ Error sending push notification: ${error.message}`);
      console.log(`❌ Error sending push notification: ${error.message}`);
      
      // Handle invalid tokens
      if (error.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`Token is no longer valid: ${token.substring(0, 10)}...`);
        console.log(`Token is no longer valid: ${token.substring(0, 10)}...`);
        // You might want to delete this token from your database
      }
      
      throw error;
    }
  }

  async sendMulticastNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: any
  ): Promise<admin.messaging.BatchResponse> {
    if (!this.firebaseApp || tokens.length === 0) {
      return;
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: data ? this.sanitizeData(data) : {},
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            this.logger.error(`Failed to send to token ${tokens[idx].substring(0, 10)}...: ${resp.error?.message}`);
          }
        });
        
        // Handle failed tokens (mark as invalid in DB)
        await this.handleFailedTokens(failedTokens);
      }
      
      this.logger.log(`✅ Multicast notification sent. Success: ${response.successCount}, Failed: ${response.failureCount}`);
      return response;
    } catch (error) {
      this.logger.error(`❌ Error sending multicast notification: ${error.message}`);
      throw error;
    }
  }

  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    if (!this.firebaseApp) return;

    const message: admin.messaging.Message = {
      topic,
      notification: { title, body },
      data: data ? this.sanitizeData(data) : {},
    };

    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`✅ Notification sent to topic "${topic}": ${response}`);
    } catch (error) {
      this.logger.error(`❌ Error sending to topic "${topic}": ${error.message}`);
      throw error;
    }
  }

  async subscribeToTopic(token: string, topic: string): Promise<void> {
    try {
      await admin.messaging().subscribeToTopic(token, topic);
      this.logger.log(`✅ Token subscribed to topic "${topic}"`);
    } catch (error) {
      this.logger.error(`❌ Error subscribing to topic: ${error.message}`);
      throw error;
    }
  }

  async unsubscribeFromTopic(token: string, topic: string): Promise<void> {
    try {
      await admin.messaging().unsubscribeFromTopic(token, topic);
      this.logger.log(`✅ Token unsubscribed from topic "${topic}"`);
    } catch (error) {
      this.logger.error(`❌ Error unsubscribing from topic: ${error.message}`);
      throw error;
    }
  }

  private sanitizeData(data: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        sanitized[key] = String(data[key]);
      }
    }
    
    // Add click action for Flutter
    sanitized['click_action'] = 'FLUTTER_NOTIFICATION_CLICK';
    return sanitized;
  }

  private async handleFailedTokens(failedTokens: string[]): Promise<void> {
    // Implement logic to mark these tokens as invalid in your database
    // This is just a placeholder - implement based on your UserDevice entity
    this.logger.warn(`Marking ${failedTokens.length} tokens as invalid`);
  }
}