import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSubService } from '../../shared/pubsub/pubsub.service';
import { UserEventTypes } from '../../shared/pubsub/events/user.events';
import { Notification } from '../entities/notification.entity';
import { NotificationType, NotificationPriority } from '../types/notification-types.enum';
import { UsersService } from '../../users/users.service';

@Injectable()
export class UserNotificationsHandler implements OnModuleInit {
  private readonly logger = new Logger(UserNotificationsHandler.name);

  constructor(
    private pubSubService: PubSubService,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private usersService: UsersService,
  ) {}

  async onModuleInit() {
    await this.subscribeToUserEvents();
    this.logger.log('User notifications handler initialized');
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
  }

  private async handleUserRegistered(eventData: any) {
    try {
      this.logger.log(`Handling user registration: ${eventData.username}`);

      // Get all approvers
      const approvers = await this.usersService.getApprovers();

      // Create notification for each approver
      const notificationPromises = approvers.map(approver =>
        this.createApproverNotification(
          approver.id.toString(),
          eventData.userId,
          eventData
        )
      );

      await Promise.all(notificationPromises);

      this.logger.log(`Created notifications for ${approvers.length} approvers`);

    } catch (error) {
      this.logger.error(`Error handling user registration:`, error);
    }
  }

  private async createApproverNotification(
    approverId: string,
    newUserId: number,
    userData: any,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const notification = this.notificationRepo.create({
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.HIGH,
      data: {
        userId: newUserId,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        displayname: userData.displayname,
        phone: userData.phone,
        departmentId: userData.departmentId,
        registrationDate: new Date().toISOString(),
        actionRequired: true,
      },
      userId: approverId,
      metadata: {
        screen: '/users/pending',
        action: 'approve_user',
        userId: newUserId,
      },
      expiresAt: expiresAt,
    });

    return await this.notificationRepo.save(notification);
  }

  private async handleUserApproved(eventData: any) {
    try {
      this.logger.log(`Handling user approval: ${eventData.username}`);

      // Create notification for the user who was approved
      await this.createUserApprovedNotification(eventData);

    } catch (error) {
      this.logger.error(`Error handling user approval:`, error);
    }
  }

  private async createUserApprovedNotification(eventData: any) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const notification = this.notificationRepo.create({
      type: NotificationType.USER_APPROVED,
      priority: NotificationPriority.HIGH,
      data: {
        message: 'Your account has been approved!',
        approvedBy: eventData.approvedBy,
        role: eventData.role,
        approvalDate: new Date().toISOString(),
        nextSteps: 'You can now log in and access the system.',
      },
      userId: eventData.userId.toString(),
      metadata: {
        screen: '/login',
        action: 'login',
        welcome: true,
      },
      expiresAt: expiresAt,
    });

    await this.notificationRepo.save(notification);
    return notification;
  }
}