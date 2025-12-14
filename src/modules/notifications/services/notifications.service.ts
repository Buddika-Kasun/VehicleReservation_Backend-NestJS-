import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../shared/redis/redis.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationPriority, NotificationType } from '../types/notification-types.enum';
import { Notification } from '../entities/notification.entity';
import { PubSubService } from '../../shared/pubsub/pubsub.service';
import { UserNotificationsHandler } from '../handlers/user-notifications.handler';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private redisService: RedisService,
    private pubSubService: PubSubService,
    private userNotificationsHandler: UserNotificationsHandler,
  ) {}

  async onModuleInit() {
    await this.initializeSubscriptions();
    
    // Initialize user notifications handler
    try {
      await this.userNotificationsHandler.onModuleInit();
      this.logger.log('User notifications handler initialized');
    } catch (error) {
      this.logger.error('Failed to initialize user notifications handler:', error);
    }
  }

  private async initializeSubscriptions() {
    try {
      // Subscribe to all notification types via Redis
      Object.values(NotificationType).forEach((type) => {
        this.redisService.subscribe(type, (message) => {
          this.handleRedisNotification(message);
        });
      });
      
      // Subscribe to PubSub events for additional processing
      await this.pubSubService.subscribe(
        'user.*',
        (event) => this.handlePubSubEvent(event),
      );
      
      this.logger.log('All notification subscriptions initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Redis subscriptions:', error);
    }
  }

  async handlePubSubEvent(event: any) {
    try {
      const { type, data } = event;
      this.logger.log(`Received PubSub event: ${type}`);
      
      switch (type) {
        case 'user.registered':
          // This is already handled by UserNotificationsHandler
          // but we can add additional logic here if needed
          break;
          
        case 'user.approved':
          // Additional processing for user approval
          break;
          
        default:
          this.logger.debug(`Unhandled PubSub event type: ${type}`);
      }
    } catch (error) {
      this.logger.error('Error handling PubSub event:', error);
    }
  }

  async create(createDto: CreateNotificationDto): Promise<Notification> {
    try {
      // Check if notification already exists (prevent duplicates)
      if (createDto.metadata?.userId && createDto.type === NotificationType.USER_REGISTERED) {
        const existing = await this.notificationRepo
          .createQueryBuilder('notification')
          .where('notification.type = :type', { type: createDto.type })
          .andWhere('notification.userId = :userId', {
            userId: createDto.userId,
          })
          .andWhere('notification.read = false')
          .andWhere(
            "notification.metadata ->> 'userId' = :metaUserId",
            { metaUserId: createDto.metadata.userId },
          )
          .getOne();
        
        if (existing) {
          this.logger.debug(`Duplicate registration notification found for user ${createDto.metadata.userId}`);
          return existing;
        }
      }

      const notification = this.notificationRepo.create(createDto);

      if (createDto.expiresIn) {
        notification.expiresAt = new Date(Date.now() + createDto.expiresIn * 1000);
      }

      const savedNotification = await this.notificationRepo.save(notification);

      // Publish to Redis for real-time delivery
      await this.redisService.publish(createDto.type, {
        notification: savedNotification,
        timestamp: new Date().toISOString(),
        eventType: createDto.type,
      });

      this.logger.debug(`Created notification: ${savedNotification.id} of type ${savedNotification.type}`);
      
      return savedNotification;
    } catch (error) {
      this.logger.error(`Failed to create notification:`, error);
      throw error;
    }
  }


  async createAndNotify(createDto: CreateNotificationDto): Promise<Notification> {
    return this.create(createDto);
  }

  private async handleRedisNotification(message: any) {
    try {
      const { notification } = message;
      this.logger.debug(`Received Redis notification: ${notification.type}`);
      
      // Additional processing can be added here if needed
      // Currently handled by UserNotificationsHandler via Pub/Sub
    } catch (error) {
      this.logger.error('Error handling Redis notification:', error);
    }
  }

  async getNotifications(
    userId: string,
    skip: number,
    limit: number,
    type?: string,
    unreadOnly?: boolean,
  ): Promise<[Notification[], number]> {
    try {
      const query = this.notificationRepo
        .createQueryBuilder('notification')
        .where('notification.isActive = :isActive', { isActive: true })
        .andWhere('(notification.userId = :userId OR notification.userId IS NULL)', {
          userId,
        })
        .orderBy('notification.createdAt', 'DESC');

      if (type) {
        query.andWhere('notification.type = :type', { type });
      }

      if (unreadOnly) {
        query.andWhere('notification.read = :read', { read: false });
      }

      const result = await query.skip(skip).take(limit).getManyAndCount();
      this.logger.debug(`Fetched ${result[0].length} notifications for user ${userId}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get notifications for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, skip = 0, limit = 50): Promise<Notification[]> {
    try {
      const notifications = await this.notificationRepo.find({
        where: [
          { userId, isActive: true },
          { userId: null, isActive: true }, // Broadcast notifications
        ],
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });
      
      this.logger.debug(`Fetched ${notifications.length} notifications for user ${userId}`);
      
      return notifications;
    } catch (error) {
      this.logger.error(`Failed to get user notifications for ${userId}:`, error);
      throw error;
    }
  }

  async getNotificationById(id: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.notificationRepo.findOne({
        where: {
          id,
          isActive: true,
          userId, // Ensure user owns this notification
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return notification;
    } catch (error) {
      this.logger.error(`Failed to get notification ${id} for user ${userId}:`, error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await this.notificationRepo.count({
        where: {
          userId,
          read: false,
          isActive: true,
        },
      });
      
      this.logger.debug(`User ${userId} has ${count} unread notifications`);
      
      return count;
    } catch (error) {
      this.logger.error(`Failed to get unread count for user ${userId}:`, error);
      throw error;
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const result = await this.notificationRepo.update(
        { id: notificationId, userId },
        { read: true },
      );

      if (result.affected === 0) {
        throw new NotFoundException('Notification not found');
      }
      
      this.logger.debug(`Marked notification ${notificationId} as read for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to mark notification ${notificationId} as read for user ${userId}:`, error);
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<{ marked: number }> {
    try {
      const result = await this.notificationRepo.update(
        { userId, read: false, isActive: true },
        { read: true },
      );
      
      const markedCount = result.affected || 0;
      this.logger.debug(`Marked ${markedCount} notifications as read for user ${userId}`);
      
      return { marked: markedCount };
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    try {
      const result = await this.notificationRepo.update(
        { id, userId, isActive: true },
        { isActive: false },
      );

      if (result.affected === 0) {
        throw new NotFoundException('Notification not found');
      }
      
      this.logger.debug(`Deleted notification ${id} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete notification ${id} for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteAllUserNotifications(userId: string): Promise<{ deleted: number }> {
    try {
      const result = await this.notificationRepo.update(
        { userId, isActive: true },
        { isActive: false },
      );

      const deletedCount = result.affected || 0;
      this.logger.debug(`Deleted ${deletedCount} notifications for user ${userId}`);
      
      return { deleted: deletedCount };
    } catch (error) {
      this.logger.error(`Failed to delete all notifications for user ${userId}:`, error);
      throw error;
    }
  }

  async broadcastNotification(createDto: CreateNotificationDto): Promise<Notification> {
    try {
      // Create notification without specific userId (broadcast to all)
      const broadcastDto = {
        ...createDto,
        userId: undefined, // Remove userId to make it broadcast
        metadata: {
          ...createDto.metadata,
          isBroadcast: true,
        },
      };

      const notification = await this.createAndNotify(broadcastDto);
      this.logger.debug(`Broadcast notification created: ${notification.id}`);
      
      return notification;
    } catch (error) {
      this.logger.error('Failed to broadcast notification:', error);
      throw error;
    }
  }

  async deleteExpired(): Promise<{ deleted: number }> {
    try {
      const result = await this.notificationRepo
        .createQueryBuilder()
        .delete()
        .where('expiresAt < NOW()')
        .andWhere('isActive = :isActive', { isActive: true })
        .execute();

      const deletedCount = result.affected || 0;
      this.logger.debug(`Deleted ${deletedCount} expired notifications`);
      
      return { deleted: deletedCount };
    } catch (error) {
      this.logger.error('Failed to delete expired notifications:', error);
      throw error;
    }
  }

  async getDailyStats(days: number = 7): Promise<any[]> {
    try {
      const date = new Date();
      date.setDate(date.getDate() - days);

      const stats = await this.notificationRepo
        .createQueryBuilder('notification')
        .select([
          'DATE(notification.createdAt) as date',
          'COUNT(*) as total',
          'SUM(CASE WHEN notification.read = true THEN 1 ELSE 0 END) as read',
          'SUM(CASE WHEN notification.read = false THEN 1 ELSE 0 END) as unread',
        ])
        .where('notification.createdAt >= :date', { date })
        .andWhere('notification.isActive = :isActive', { isActive: true })
        .groupBy('DATE(notification.createdAt)')
        .orderBy('date', 'ASC')
        .getRawMany();

      this.logger.debug(`Fetched daily stats for ${days} days`);
      
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get daily stats:`, error);
      throw error;
    }
  }

  async getNotificationCountByType(): Promise<any[]> {
    try {
      const stats = await this.notificationRepo
        .createQueryBuilder('notification')
        .select([
          'notification.type as type',
          'COUNT(*) as total',
          'SUM(CASE WHEN notification.read = true THEN 1 ELSE 0 END) as read',
          'SUM(CASE WHEN notification.read = false THEN 1 ELSE 0 END) as unread',
        ])
        .where('notification.isActive = :isActive', { isActive: true })
        .groupBy('notification.type')
        .orderBy('total', 'DESC')
        .getRawMany();

      this.logger.debug('Fetched notification count by type');
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get notification count by type:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Notification> {
    try {
      const notification = await this.notificationRepo.findOne({
        where: { id, isActive: true },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return notification;
    } catch (error) {
      this.logger.error(`Failed to find notification ${id}:`, error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Notification[]> {
    try {
      const notifications = await this.notificationRepo.find({
        where: { userId, isActive: true },
        order: { createdAt: 'DESC' },
      });
      
      this.logger.debug(`Found ${notifications.length} notifications for user ${userId}`);
      
      return notifications;
    } catch (error) {
      this.logger.error(`Failed to find notifications for user ${userId}:`, error);
      throw error;
    }
  }

  async updateReadStatus(id: string, read: boolean): Promise<void> {
    try {
      await this.notificationRepo.update({ id }, { read });
      this.logger.debug(`Updated read status of notification ${id} to ${read}`);
    } catch (error) {
      this.logger.error(`Failed to update read status of notification ${id}:`, error);
      throw error;
    }
  }

  async deleteById(id: string): Promise<void> {
    try {
      await this.notificationRepo.delete(id);
      this.logger.debug(`Deleted notification ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete notification ${id}:`, error);
      throw error;
    }
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    try {
      const count = await this.notificationRepo.count({
        where: { userId, read: false, isActive: true },
      });
      
      return count;
    } catch (error) {
      this.logger.error(`Failed to count unread notifications for user ${userId}:`, error);
      throw error;
    }
  }

  async createNotificationForUsers(
    userIds: string[],
    type: NotificationType,
    data: any,
    priority?: NotificationPriority,
    metadata?: any,
    expiresIn?: number,
  ): Promise<Notification[]> {
    try {
      const notifications: Notification[] = [];
      
      for (const userId of userIds) {
        const createDto: CreateNotificationDto = {
          type,
          data,
          priority,
          userId,
          metadata,
          expiresIn,
        };
        
        const notification = await this.create(createDto);
        notifications.push(notification);
      }
      
      this.logger.debug(`Created ${notifications.length} notifications of type ${type}`);
      
      return notifications;
    } catch (error) {
      this.logger.error(`Failed to create notifications for users:`, error);
      throw error;
    }
  }

  async getUnreadNotifications(userId: string, limit?: number): Promise<Notification[]> {
    try {
      const query = this.notificationRepo
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId })
        .andWhere('notification.read = :read', { read: false })
        .andWhere('notification.isActive = :isActive', { isActive: true })
        .orderBy('notification.createdAt', 'DESC');

      if (limit) {
        query.take(limit);
      }

      const notifications = await query.getMany();
      
      return notifications;
    } catch (error) {
      this.logger.error(`Failed to get unread notifications for user ${userId}:`, error);
      throw error;
    }
  }

  async clearOldNotifications(userId: string, daysOld: number = 30): Promise<{ cleared: number }> {
    try {
      const date = new Date();
      date.setDate(date.getDate() - daysOld);

      const result = await this.notificationRepo
        .createQueryBuilder()
        .delete()
        .where('userId = :userId', { userId })
        .andWhere('createdAt < :date', { date })
        .andWhere('read = :read', { read: true })
        .andWhere('isActive = :isActive', { isActive: true })
        .execute();

      const clearedCount = result.affected || 0;
      this.logger.debug(`Cleared ${clearedCount} old notifications for user ${userId}`);
      
      return { cleared: clearedCount };
    } catch (error) {
      this.logger.error(`Failed to clear old notifications for user ${userId}:`, error);
      throw error;
    }
  }
}