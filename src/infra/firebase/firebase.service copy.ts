import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const credentialsPath = this.configService.get<string>('FIREBASE_CREDENTIALS_PATH');
    
    if (credentialsPath) {
      try {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(credentialsPath),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } catch (error) {
        this.logger.error(`Failed to initialize Firebase: ${error.message}`);
      }
    } else {
      this.logger.warn('FIREBASE_CREDENTIALS_PATH not found. Push notifications will be disabled.');
    }
  }

  async sendPushNotification(token: string, title: string, body: string, data?: any): Promise<void> {
    if (!this.firebaseApp) {
      this.logger.warn('Push notification skipped: Firebase not initialized');
      return;
    }

    const message: admin.messaging.Message = {
      token,
      notification: { title, body },
      data: data ? this.sanitizeData(data) : {},
    };

    try {
      await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully to token: ${token.substring(0, 10)}...`);
    } catch (error) {
      this.logger.error(`Error sending push notification: ${error.message}`);
    }
  }

  private sanitizeData(data: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const key in data) {
      sanitized[key] = String(data[key]);
    }
    return sanitized;
  }
}
