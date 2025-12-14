import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSubService } from '../../shared/pubsub/pubsub.service';
import { UserEventTypes } from '../../shared/pubsub/events/user.events';
import { Notification } from '../entities/notification.entity';
import { NotificationType, NotificationPriority } from '../types/notification-types.enum';
import { UsersService } from '../../users/users.service';
import { RedisService } from '../../shared/redis/redis.service';

@Injectable()
export class UserNotificationsHandler implements OnModuleInit {
  private readonly logger = new Logger(UserNotificationsHandler.name);
  
  // Track processed events to prevent duplicates
  private processedEvents = new Set<string>();
  private readonly EVENT_TTL = 60000; // 60 seconds

  constructor(
    private pubSubService: PubSubService,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private usersService: UsersService,
    private redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.subscribeToUserEvents();
    this.logger.log('User notifications handler initialized');
    
    // Clean up processed events periodically
    setInterval(() => {
      this.processedEvents.clear();
      this.logger.debug('Cleared processed events cache');
    }, this.EVENT_TTL);
  }

  private async subscribeToUserEvents() {
    // Subscribe to user registered event
    await this.pubSubService.subscribe(
      UserEventTypes.USER_REGISTERED,
      (event) => this.handleUserRegistered(event.data)
    );

    // Subscribe to user approved event
    await this.pubSubService.subscribe(
      UserEventTypes.USER_APPROVED,
      (event) => this.handleUserApproved(event.data)
    );

    this.logger.log('Subscribed to user events');
  }

  private async handleUserRegistered(eventData: any) {
    // Create unique event ID to prevent duplicate processing
    const eventId = `USER_REGISTERED:${eventData.userId}:${eventData.timestamp || Date.now()}`;
    
    // Check if we've already processed this event
    if (this.processedEvents.has(eventId)) {
      this.logger.warn(`Duplicate event detected and skipped: ${eventId}`);
      return;
    }
    
    // Mark event as processed
    this.processedEvents.add(eventId);

    try {
      this.logger.log(`🔔 Handling user registration: ${eventData.username} (ID: ${eventData.userId})`);

      // Check if notifications already exist for this user registration
      const existingNotifications = await this.notificationRepo.count({
        where: {
          type: NotificationType.USER_REGISTERED,
          data: {
            userId: eventData.userId,
          } as any,
          isActive: true,
        },
      });

      if (existingNotifications > 0) {
        this.logger.warn(
          `⚠️ Notifications already exist for user ${eventData.userId}. Skipping creation. (Found: ${existingNotifications})`
        );
        return;
      }

      // Get all approvers (admins, sysadmins, hr, authLevel 3)
      const approvers = await this.usersService.getApprovers();

      this.logger.log(`📋 Found ${approvers.length} approvers to notify`);

      if (approvers.length === 0) {
        this.logger.warn('⚠️ No approvers found to notify about user registration');
        return;
      }

      // Create notification for each approver sequentially to avoid race conditions
      let successCount = 0;
      let skipCount = 0;
      
      for (const approver of approvers) {
        try {
          // Double-check: Does this approver already have a notification for this user?
          const existingForApprover = await this.notificationRepo.findOne({
            where: {
              type: NotificationType.USER_REGISTERED,
              userId: approver.id.toString(),
              data: {
                userId: eventData.userId,
              } as any,
              isActive: true,
            },
          });

          if (existingForApprover) {
            this.logger.debug(
              `⏭️ Approver ${approver.id} already has notification for user ${eventData.userId}. Skipping.`
            );
            skipCount++;
            continue;
          }

          const notification = await this.createApproverNotification(
            approver.id.toString(),
            eventData.userId,
            eventData
          );

          // Publish to Redis for real-time delivery via WebSocket
          await this.redisService.publish(NotificationType.USER_REGISTERED, {
            notification: {
              id: notification.id,
              type: notification.type,
              title: 'New User Registration',
              message: `${eventData.username} has registered for an account`,
              data: notification.data,
              read: notification.read,
              createdAt: notification.createdAt,
              isPending: true,
              metadata: notification.metadata,
            },
            timestamp: new Date().toISOString(),
            eventType: NotificationType.USER_REGISTERED,
          });

          this.logger.debug(`✅ Created notification ${notification.id} for approver ${approver.id}`);
          successCount++;
        } catch (error) {
          this.logger.error(`❌ Failed to create notification for approver ${approver.id}:`, error);
        }
      }
      
      this.logger.log(
        `✅ Successfully created ${successCount} notifications (${skipCount} skipped as duplicates) for user ${eventData.userId}`
      );

    } catch (error) {
      this.logger.error(`❌ Error handling user registration:`, error);
      this.logger.error(error.stack);
    }
  }

  private async createApproverNotification(
    approverId: string,
    newUserId: number,
    userData: any,
  ): Promise<Notification> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const notification = this.notificationRepo.create({
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.HIGH,
      data: {
        userId: newUserId,
        username: userData.username,
        email: userData.email || null,
        role: userData.role,
        displayname: userData.displayname,
        phone: userData.phone,
        departmentId: userData.departmentId,
        registrationDate: userData.timestamp || new Date().toISOString(),
        actionRequired: true,
        message: 'New user registered and awaiting approval',
      },
      userId: approverId,
      metadata: {
        screen: '/users/pending',
        action: 'approve_user',
        userId: newUserId,
        autoAssign: true,
        requiresScreenRefresh: true,
      },
      expiresAt: expiresAt,
      read: false,
      isActive: true,
    });

    const savedNotification = await this.notificationRepo.save(notification);
    this.logger.debug(`💾 Saved notification ${savedNotification.id} for approver ${approverId}`);
    
    return savedNotification;
  }

  private async handleUserApproved(eventData: any) {
    // Create unique event ID
    const eventId = `USER_APPROVED:${eventData.userId}:${eventData.timestamp || Date.now()}`;
    
    // Check if we've already processed this event
    if (this.processedEvents.has(eventId)) {
      this.logger.warn(`Duplicate event detected and skipped: ${eventId}`);
      return;
    }
    
    // Mark event as processed
    this.processedEvents.add(eventId);

    try {
      this.logger.log(`🎉 Handling user approval: ${eventData.username} (ID: ${eventData.userId})`);

      // Check if notification already exists
      const existingNotification = await this.notificationRepo.findOne({
        where: {
          type: NotificationType.USER_APPROVED,
          userId: eventData.userId.toString(),
          isActive: true,
        },
      });

      if (existingNotification) {
        this.logger.warn(
          `⚠️ Approval notification already exists for user ${eventData.userId}. Skipping.`
        );
        return;
      }

      // Create notification for the user who was approved
      const notification = await this.createUserApprovedNotification(eventData);

      // Publish to Redis for real-time delivery
      await this.redisService.publish(NotificationType.USER_APPROVED, {
        notification: {
          id: notification.id,
          type: notification.type,
          title: 'Account Approved',
          message: 'Your account has been approved by an administrator',
          data: notification.data,
          read: notification.read,
          createdAt: notification.createdAt,
          isPending: false,
          metadata: notification.metadata,
        },
        timestamp: new Date().toISOString(),
        eventType: NotificationType.USER_APPROVED,
      });

      this.logger.log(`✅ Created and published approval notification for user ${eventData.userId}`);

    } catch (error) {
      this.logger.error(`❌ Error handling user approval:`, error);
      this.logger.error(error.stack);
    }
  }

  private async createUserApprovedNotification(eventData: any): Promise<Notification> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days

    const notification = this.notificationRepo.create({
      type: NotificationType.USER_APPROVED,
      priority: NotificationPriority.HIGH,
      data: {
        message: 'Your account has been approved!',
        approvedBy: eventData.approvedBy,
        role: eventData.role,
        approvalDate: eventData.timestamp || new Date().toISOString(),
        nextSteps: 'You can now log in and access the system.',
      },
      userId: eventData.userId.toString(),
      metadata: {
        screen: '/login',
        action: 'login',
        welcome: true,
      },
      expiresAt: expiresAt,
      read: false,
      isActive: true,
    });

    const savedNotification = await this.notificationRepo.save(notification);
    this.logger.debug(`💾 Saved approval notification ${savedNotification.id} for user ${eventData.userId}`);
    
    return savedNotification;
  }
}