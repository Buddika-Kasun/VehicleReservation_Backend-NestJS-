import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from 'src/infra/redis/event-bus.service';
import { NotificationsService } from '../notifications.service';
import { NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';
import { EVENTS } from 'src/common/constants/events.constants';

@Injectable()
export class UserNotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(UserNotificationHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.eventBus.subscribe(EVENTS.USER.CREATE, this.handleUserCreated.bind(this));
    this.eventBus.subscribe(EVENTS.USER.STATUS_CHANGE, this.handleUserStatusChanged.bind(this));
    this.eventBus.subscribe(EVENTS.USER.APPROVE, this.handleUserApproved.bind(this));
    this.eventBus.subscribe(EVENTS.USER.REJECT, this.handleUserRejected.bind(this));
    
    this.logger.log('UserNotificationHandler initialized');
  }

  private async handleUserCreated(data: any): Promise<void> {
    const { userId, username, email, role } = data;
    
    const approvers = await this.notificationsService.getApprovers();
    
    for (const approver of approvers) {
      await this.notificationsService.create({
        type: NotificationType.USER_REGISTERED,
        userId: String(approver.id),
        title: 'New User Registration',
        message: `User ${username || 'Unknown'} has registered.`,
        data: { id: userId, username, email, role },
        priority: NotificationPriority.MEDIUM,
      });
    }
    
    this.logger.log(`Created notifications for user registration: ${userId}`);
  }

  private async handleUserStatusChanged(data: any): Promise<void> {
    const { userId, status } = data;
    
    const type = status === 'approved' ? NotificationType.USER_APPROVED : NotificationType.USER_REJECTED;
    const title = status === 'approved' ? 'Account Approved' : 'Account Rejected';
    const message = status === 'approved' 
      ? 'Your account has been approved. You can now log in.' 
      : 'Your account registration has been rejected. Please contact support.';
    
    await this.notificationsService.create({
      type,
      userId,
      title,
      message,
      data: { userId, status },
      priority: NotificationPriority.HIGH,
    });
  }

  private async handleUserApproved(data: any): Promise<void> {
    await this.handleUserStatusChanged({ ...data, status: 'approved' });
  }

  private async handleUserRejected(data: any): Promise<void> {
    await this.handleUserStatusChanged({ ...data, status: 'rejected' });
  }
}