import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification, NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationPaginationDto } from './dto/notification-pagination.dto';
import { RedisService } from 'src/infra/redis/redis.service';
import { FirebaseService } from '../../infra/firebase/firebase.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private redisClient: any;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly firebaseService: FirebaseService,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      isActive: true,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Emit event for real-time notifications
    this.eventEmitter.emit('notification.created', savedNotification);

    // Publish to Redis for cross-instance refresh signals
    await this.publishRefresh(savedNotification);

    // Send push notification if FCM is enabled
    if (savedNotification.userId) {
      await this.sendPushNotification(savedNotification);
    }

    this.logger.log(`Notification created: ${savedNotification.id} for user: ${savedNotification.userId}`);

    return savedNotification;
  }

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

    if (read !== undefined) {
      queryBuilder.andWhere('notification.read = :read', { read });
    }

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (priority) {
      queryBuilder.andWhere('notification.priority = :priority', { priority });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: number, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId, isActive: true },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  async markAsRead(id: number, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);

    if (!notification.read) {
      notification.read = true;
      await this.notificationRepository.save(notification);

      // Emit event
      this.eventEmitter.emit('notification.read', notification);
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, read: false, isActive: true },
      { read: true },
    );

    // Emit event
    this.eventEmitter.emit('notification.allRead', { userId });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, read: false, isActive: true },
    });
  }

  async delete(id: number, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);
    notification.isActive = false;
    await this.notificationRepository.save(notification);

    // Emit event
    this.eventEmitter.emit('notification.deleted', notification);
  }

  // Scheduled task to clean up expired notifications
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

  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      if (!notification.userId) return;

      const user = await this.userRepository.findOne({ where: { id: Number(notification.userId) } });

      if (!user || !user.fcmToken) {
        return;
      }

      await this.firebaseService.sendPushNotification(
        user.fcmToken,
        notification.title || 'New Notification',
        notification.message || 'You have a new notification',
        {
          id: String(notification.id),
          type: notification.type,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to trigger push notification flow: ${error.message}`);
    }
  }

  // Helper methods for creating specific notification types
  async createUserRegisteredNotification(userId: string, userData: any): Promise<Notification> {
    return this.create({
      type: NotificationType.USER_REGISTERED,
      userId,
      title: 'New User Registration',
      message: `User ${userData.username || 'Unknown'} has registered.`,
      data: userData,
      priority: NotificationPriority.MEDIUM,
    });
  }

  async createTripStatusNotification(
    userId: string,
    tripId: string,
    status: string,
    tripData: any,
  ): Promise<Notification> {
    let type: NotificationType;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    switch (status) {
      case 'pending':
        type = NotificationType.TRIP_CREATED;
        break;
      case 'approved':
        type = NotificationType.TRIP_UPDATED;
        priority = NotificationPriority.HIGH;
        break;
      case 'rejected':
        type = NotificationType.TRIP_UPDATED;
        priority = NotificationPriority.HIGH;
        break;
      case 'completed':
        type = NotificationType.TRIP_COMPLETED;
        break;
      default:
        type = NotificationType.TRIP_UPDATED;
    }

    return this.create({
      type,
      userId,
      data: { tripId, status, ...tripData },
      priority,
    });
  }
  async notifyUserStatus(user: User, status: string): Promise<void> {
    const type = status === 'approved' ? NotificationType.USER_APPROVED : NotificationType.USER_REJECTED;
    const title = status === 'approved' ? 'Account Approved' : 'Account Rejected';
    const message = status === 'approved' 
      ? 'Your account has been approved. You can now log in.' 
      : 'Your account registration has been rejected. Please contact support.';
    
    await this.create({
      type,
      userId: String(user.id),
      title,
      message,
      data: { userId: user.id, status },
      priority: NotificationPriority.HIGH,
    });
  }

  async notifyTripStatus(trip: any, status: string, previousStatus?: string): Promise<void> {
    let type: NotificationType;
    let title: string;
    let message: string;
    let priority = NotificationPriority.MEDIUM;
    let userId = String(trip.userId || trip.requester?.id);

    switch (status) {
      case 'cancelled':
        type = NotificationType.TRIP_CANCELLED;
        title = 'Trip Cancelled';
        message = `Trip #${trip.id} has been cancelled.`;
        break;
      case 'approved':
        type = NotificationType.TRIP_APPROVED;
        title = 'Trip Approved';
        message = `Your trip request #${trip.id} has been approved.`;
        priority = NotificationPriority.HIGH;
        break;
      case 'rejected':
        type = NotificationType.TRIP_REJECTED;
        title = 'Trip Rejected';
        message = `Your trip request #${trip.id} has been rejected.`;
        priority = NotificationPriority.HIGH;
        break;
      case 'ongoing':
        type = NotificationType.TRIP_STARTED;
        title = 'Trip Started';
        message = `Trip #${trip.id} has started.`;
        break;
      case 'finished':
      case 'completed':
        type = NotificationType.TRIP_FINISHED;
        title = 'Trip Completed';
        message = `Trip #${trip.id} has been completed.`;
        break;
      default:
        type = NotificationType.TRIP_UPDATED;
        title = 'Trip Updated';
        message = `Trip #${trip.id} status changed to ${status}.`;
    }

    await this.create({
      type,
      userId,
      title,
      message,
      data: { tripId: trip.id, status },
      priority,
    });
  }

  async notifyVehicleAssignment(vehicle: any, driverId: number, action: 'assigned' | 'unassigned' | 'updated'): Promise<void> {
    let type: NotificationType;
    let title: string;
    let message: string;

    switch (action) {
      case 'assigned':
        type = NotificationType.VEHICLE_ASSIGNED;
        title = 'Vehicle Assigned';
        message = `You have been assigned to vehicle ${vehicle.regNo} (${vehicle.model}).`;
        break;
      case 'unassigned':
        type = NotificationType.VEHICLE_UNASSIGNED;
        title = 'Vehicle Unassigned';
        message = `You have been unassigned from vehicle ${vehicle.regNo}.`;
        break;
      case 'updated':
        type = NotificationType.VEHICLE_UPDATED;
        title = 'Vehicle Updated';
        message = `Details for your assigned vehicle ${vehicle.regNo} have been updated.`;
        break;
    }

    if (driverId) {
      await this.create({
        type,
        userId: String(driverId),
        title,
        message,
        data: { vehicleId: vehicle.id, regNo: vehicle.regNo },
        priority: NotificationPriority.MEDIUM,
      });
    }
  }

  async notifySecurity(title: string, message: string, data?: any): Promise<void> { 
    // Import UserRole if available, or use string 'security'
    const securityUsers = await this.userRepository.find({ where: { role: 'security' as any } });

    for (const user of securityUsers) {
      await this.create({
        type: NotificationType.SYSTEM_ALERT,
        userId: String(user.id),
        title,
        message,
        data,
        priority: NotificationPriority.HIGH,
      });
    }
  }

  /**
   * Publish a refresh signal to the appropriate Redis channel based on notification type.
   */
  private async publishRefresh(notification: Notification): Promise<void> {
    const payload = JSON.stringify({
      userId: notification.userId,
      scope: this.determineScope(notification.type),
      notificationId: notification.id
    });

    const channel = this.determineChannel(notification.type);
    await this.redisClient.publish(channel, payload);
    this.logger.debug(`Published refresh to ${channel} for user ${notification.userId}`);
  }

  private determineChannel(type: NotificationType): string {
    if (type.startsWith('TRIP_')) return 'refresh.trips';
    if (type.startsWith('VEHICLE_')) return 'refresh.trips'; // Vehicles affect Trip/Assigned Rides views
    if (type.startsWith('USER_')) return 'refresh.users';
    return 'refresh.notifications';
  }

  private determineScope(type: NotificationType): string {
    return type;
  }
}
