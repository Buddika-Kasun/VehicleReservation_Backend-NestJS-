// src/modules/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification, NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationPaginationDto } from './dto/notification-pagination.dto';
import { FirebaseService } from '../../infra/firebase/firebase.service';
import { EventBusService } from 'src/infra/redis/event-bus.service';
import { EVENTS } from 'src/common/constants/events.constants';
import { access } from 'fs';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    private readonly firebaseService: FirebaseService,
    private readonly eventBus: EventBusService,
  ) {}

  // CREATE
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      isActive: true,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Send push notification
    if (savedNotification.userId) {
      await this.sendPushNotification(savedNotification);
      
      // Publish event for gateway
      await this.eventBus.publish('NOTIFICATION', 'CREATE', {
        notificationId: savedNotification.id,
        userId: savedNotification.userId,
        type: savedNotification.type,
      });
    }

    return savedNotification;
  }

  // READ
  async findAllForUser(
    userId: string,
    paginationDto: NotificationPaginationDto,
  ): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, read, type, priority, isActive = true } = paginationDto;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.isActive = :isActive', { isActive })
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (read !== undefined) queryBuilder.andWhere('notification.read = :read', { read });
    if (type) queryBuilder.andWhere('notification.type = :type', { type });
    if (priority) queryBuilder.andWhere('notification.priority = :priority', { priority });

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: number, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId, isActive: true },
    });

    if (!notification) throw new Error('Notification not found');
    return notification;
  }

  // UPDATE
  async markAsRead(id: number, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);

    if (!notification.read) {
      notification.read = true;
      const savedNotification = await this.notificationRepository.save(notification);

      
      await this.eventBus.publish('NOTIFICATION', 'REFRESH', {
        notificationId: savedNotification.id,
        userId: savedNotification.userId,
        action: 'refresh',
      });
      

      return savedNotification;
    }

    return notification;
  }

  async markAsUnread(id: number, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);

    if (notification.read) {
      notification.read = false;
      const savedNotification = await this.notificationRepository.save(notification);

      await this.eventBus.publish('NOTIFICATION', 'REFRESH', {
        notificationId: savedNotification.id,
        userId: savedNotification.userId,
        action: 'refresh',
      });

      return savedNotification;
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, read: false, isActive: true },
      { read: true },
    );

    await this.eventBus.publish('NOTIFICATION', 'REFRESH', { userId });
  }

  // DELETE
  async delete(id: number, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);
    notification.isActive = false;
    await this.notificationRepository.save(notification);

    await this.eventBus.publish('NOTIFICATION', 'REFRESH', {
      notificationId: notification.id,
      userId: notification.userId,
      access: 'refresh',
    });

  }

  async deleteAll(userId: string): Promise<void> {
    await this.notificationRepository
    .createQueryBuilder()
    .update(Notification)
    .set({ isActive: false })
    .where('userId = :userId AND isActive = :isActive', { 
      userId, 
      isActive: true 
    })
    .execute();

    //await this.eventBus.publish('NOTIFICATION', 'DELETE_ALL', { userId });
  }

  // UTILITIES
  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, read: false, isActive: true },
    });
  }

  async getApprovers(): Promise<User[]> {
    return await this.userRepository.find({
      where: { isActive: true },
    });
  }

  // SCHEDULED TASKS
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredNotifications(): Promise<void> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isActive: false })
      .where('isActive = :isActive', { isActive: true })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt < NOW()')
      .execute();

    if (result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired notifications`);
    }
  }

  // PRIVATE METHODS
  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      if (!notification.userId) return;

      const user = await this.userRepository.findOne({ 
        where: { id: Number(notification.userId) } 
      });

      if (!user || !user.fcmToken) return;

      await this.firebaseService.sendPushNotification(
        user.fcmToken,
        notification.title || 'New Notification',
        notification.message || 'You have a new notification',
        { 
          id: String(notification.id), 
          type: notification.type,
          tripId: notification.data?.tripId ? String(notification.data.tripId) : undefined,
          userId: String(notification.userId),
          createdAt: notification.createdAt.toISOString(), 
        }
      );
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
    }
  }

  // src/modules/notifications/notifications.service.ts (additional methods)
  // Add these methods to your existing NotificationsService class:

  async sendBatchNotifications(
    userIds: string[],
    title: string,
    message: string,
    type?: NotificationType,
    data?: any,
  ): Promise<void> {
    try {
      // Get all active FCM tokens for these users
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.id IN (:...userIds)', { userIds })
        .andWhere('user.fcmToken IS NOT NULL')
        .andWhere('user.isActive = :isActive', { isActive: true })
        .getMany();

      const tokens = users.map(user => user.fcmToken).filter(Boolean);
      
      if (tokens.length > 0) {
        await this.firebaseService.sendMulticastNotification(
          tokens,
          title,
          message,
          { ...data, type: type || NotificationType.SYSTEM_ALERT }
        );
      }

      // Also create notification records in DB
      for (const userId of userIds) {
        const notification = this.notificationRepository.create({
          userId,
          title,
          message,
          type: type || NotificationType.SYSTEM_ALERT,
          priority: NotificationPriority.MEDIUM,
          isActive: true,
        });

        await this.notificationRepository.save(notification);
      }
    } catch (error) {
      this.logger.error(`Error sending batch notifications: ${error.message}`);
    }
  }

  async updateUserFcmToken(userId: string, fcmToken: string): Promise<void> {
    try {
      await this.userRepository.update(
        { id: Number(userId) },
        { fcmToken, updatedAt: new Date() }
      );
      
      this.logger.log(`Updated FCM token for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating FCM token: ${error.message}`);
      throw error;
    }
  }

  async deleteUserFcmToken(userId: string): Promise<void> {
    try {
      await this.userRepository.update(
        { id: Number(userId) },
        { fcmToken: null, updatedAt: new Date() }
      );
      
      this.logger.log(`Deleted FCM token for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting FCM token: ${error.message}`);
      throw error;
    }
  }

  async sendToTopic(
    topic: string,
    title: string,
    message: string,
    type?: NotificationType,
    data?: any,
  ): Promise<void> {
    try {
      await this.firebaseService.sendToTopic(
        topic,
        title,
        message,
        { ...data, type: type || NotificationType.SYSTEM_ALERT }
      );
      
      this.logger.log(`Notification sent to topic "${topic}"`);
    } catch (error) {
      this.logger.error(`Error sending to topic "${topic}": ${error.message}`);
      throw error;
    }
  }

  async subscribeUserToTopic(userId: string, topic: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ 
        where: { id: Number(userId) } 
      });

      if (!user || !user.fcmToken) {
        throw new Error('User or FCM token not found');
      }

      await this.firebaseService.subscribeToTopic(user.fcmToken, topic);
      this.logger.log(`User ${userId} subscribed to topic "${topic}"`);
    } catch (error) {
      this.logger.error(`Error subscribing to topic: ${error.message}`);
      throw error;
    }
  }

}