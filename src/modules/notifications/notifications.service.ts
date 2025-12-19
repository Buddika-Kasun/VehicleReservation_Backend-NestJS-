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
    }

    // Publish event for gateway
    await this.eventBus.publish('NOTIFICATION', 'CREATE', {
      notificationId: savedNotification.id,
      userId: savedNotification.userId,
      type: savedNotification.type,
    });

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

      await this.eventBus.publish('NOTIFICATION', 'READ', {
        notificationId: savedNotification.id,
        userId: savedNotification.userId,
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

    await this.eventBus.publish('NOTIFICATION', 'READ_ALL', { userId });
  }

  // DELETE
  async delete(id: number, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);
    notification.isActive = false;
    await this.notificationRepository.save(notification);

    await this.eventBus.publish('NOTIFICATION', 'DELETE', {
      notificationId: notification.id,
      userId: notification.userId,
    });
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
        { id: String(notification.id), type: notification.type }
      );
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
    }
  }
}