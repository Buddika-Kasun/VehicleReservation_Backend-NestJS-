import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from 'src/infra/redis/event-bus.service';
import { NotificationsService } from '../notifications.service';
import { NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';
import { EVENTS } from 'src/common/constants/events.constants';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class TripNotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(TripNotificationHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationsService: NotificationsService,
    private readonly userService: UsersService,
  ) {}

  async onModuleInit() {
    this.eventBus.subscribe(EVENTS.TRIP.CREATE, this.handleTripCreated.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.CONFIRM, this.handleTripConfirm.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.STATUS_CHANGE, this.handleTripStatusChange.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.APPROVE, this.handleTripApproved.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.REJECT, this.handleTripRejected.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.START, this.handleTripStarted.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.COMPLETE, this.handleTripCompleted.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.CANCEL, this.handleTripCancelled.bind(this));
    
    this.logger.log('TripNotificationHandler initialized');
  }

  private async handleTripCreated(data: any): Promise<void> {
    const { tripId, userId, userName, userRole } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_CREATED,
      userId,
      title: 'Trip Created',
      message: `Your trip request #${tripId} has been created and is pending approval.`,
      data,
      priority: NotificationPriority.LOW,
    });

    const supervisors = await this.userService.getTransportSupervisors();
    
    for (const supervisor of supervisors) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_CREATED,
        userId: String(supervisor.id),
        title: 'New Trip Created',
        message: `Trip #${tripId} has been created by ${userName}(${userRole}) and awaiting assignment of vehicle and confirmation.`,
        data,
        priority: NotificationPriority.HIGH,
      });
    }

  }

  private async handleTripConfirm(data: any): Promise<void> {
    
    const { tripId, userId, approvers, userName, userRole } = data;

    await this.notificationsService.create({
      type: NotificationType.TRIP_CONFIRMED,
      userId: String(userId),
      title: 'Trip Confirmed',
      message: `Trip #${tripId} has been confirmed by you.`,
      data,
      priority: NotificationPriority.LOW,
    });

    // Create notifications for approvers
    if (approvers && Array.isArray(approvers)) {
      for (const approver of approvers) {
        if (approver && approver.id) {
          await this.notificationsService.create({
            type: NotificationType.TRIP_CONFIRMED,
            userId: String(approver.id),
            title: 'New Trip Approval',
            message: `Trip #${tripId} has been confirmed by ${userName}(TRANSPORT SUPERVISOR) and is awaiting approval.`,
            data: { tripId },
            priority: NotificationPriority.HIGH,
          });
        }
      }
    }
    
  }

  private async handleTripCancelled(data: any): Promise<void> {
    const { tripId, userId, userName, requesterId } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_CANCELLED,
      userId: String(userId),
      title: 'Trip Cancelled',
      message: `Trip #${tripId} has been cancelled by you.`,
      data,
      priority: NotificationPriority.LOW,
    });

    await this.notificationsService.create({
      type: NotificationType.TRIP_CANCELLED,
      userId: String(requesterId),
      title: 'Trip Cancelled',
      message: `Your trip #${tripId} has been cancelled by ${userName}(TRANSPORT SUPERVISOR).`,
      data,
      priority: NotificationPriority.HIGH,
    });

  }

  private async handleTripApproved(data: any): Promise<void> {
    const { tripId, userId, eventData} = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_APPROVED,
      userId: String(userId),
      title: 'Trip Approved',
      message: `Trip #${tripId} has been approved.`,
      data: { ...data, eventData },
      priority: NotificationPriority.LOW,
    });

    if (eventData.isApproved && eventData.requesterId) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_APPROVED,
        userId: String(eventData.requesterId),
        title: 'Trip Approved',
        message: `Your trip #${tripId} has been approved. Please be prepared and go on time.`,
        data: { ...data, eventData },
        priority: NotificationPriority.HIGH,
      });
    }

    if (eventData.isApproved && eventData.driverId) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_APPROVED,
        userId: String(eventData.driverId),
        title: 'Trip Approved',
        message: `You have been assigned as driver for trip #${tripId}, which has been approved. Please be prepared for meter reading and commencement.`,
        data: { ...data, eventData },
        priority: NotificationPriority.HIGH,
      });
    }

    if (eventData.isApproved) {
      const securities = await this.userService.getSecurities();
    
      for (const security of securities) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_APPROVED,
          userId: String(security.id),
          title: 'New Trip Approved',
          message: `Trip #${tripId} has been approved and awaiting meter reading and commencement.`,
          data,
          priority: NotificationPriority.HIGH,
        });
      }
    }    

  }

  private async handleTripRejected(data: any): Promise<void> {
    const { 
      tripId, 
      userId, 
      userName,
      userRole,
      approval1Id,
      approval2Id,
      safetyApproverId,
      requesterId,
      rejectionReason 
    } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_REJECTED,
      userId: String(userId),
      title: 'Trip Rejected',
      message: `Trip #${tripId} has been rejected.`,
      data: data,
      priority: NotificationPriority.LOW,
    });

    await this.notificationsService.create({
      type: NotificationType.TRIP_REJECTED,
      userId: String(requesterId),
      title: 'Trip Rejected',
      message: `Your trip #${tripId} has been rejected by ${userName}(${userRole}), Reason: ${rejectionReason}`,
      data: data,
      priority: NotificationPriority.LOW,
    });

    if (userId !== approval1Id) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_REJECTED,
        userId: String(approval1Id),
        title: 'Trip Rejected',
        message: `Trip #${tripId} has been rejected by ${userName}(${userRole}), Reason: ${rejectionReason}`,
        data: data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    if (userId !== approval2Id) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_REJECTED,
        userId: String(approval2Id),
        title: 'Trip Rejected',
        message: `Trip #${tripId} has been rejected by ${userName}(${userRole}), Reason: ${rejectionReason}`,
        data: data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    if (userId !== safetyApproverId) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_REJECTED,
        userId: String(safetyApproverId),
        title: 'Trip Rejected',
        message: `Trip #${tripId} has been rejected by ${userName}(${userRole}), Reason: ${rejectionReason}`,
        data: data,
        priority: NotificationPriority.MEDIUM,
      });
    }

  }
  // last done

  private async handleTripStatusChange(data: any): Promise<void> {
    const { tripId, userId, status } = data;
    
    let type: NotificationType;
    let title: string;
    let message: string;
    let priority = NotificationPriority.MEDIUM;

    switch (status) {
      case 'approved':
        type = NotificationType.TRIP_APPROVED;
        title = 'Trip Approved';
        message = `Your trip request #${tripId} has been approved.`;
        priority = NotificationPriority.HIGH;
        break;
      case 'rejected':
        type = NotificationType.TRIP_REJECTED;
        title = 'Trip Rejected';
        message = `Your trip request #${tripId} has been rejected.`;
        priority = NotificationPriority.HIGH;
        break;
      case 'ongoing':
        type = NotificationType.TRIP_STARTED;
        title = 'Trip Started';
        message = `Trip #${tripId} has started.`;
        break;
      case 'completed':
        type = NotificationType.TRIP_COMPLETED;
        title = 'Trip Completed';
        message = `Trip #${tripId} has been completed.`;
        break;
      case 'cancelled':
        type = NotificationType.TRIP_CANCELLED;
        title = 'Trip Cancelled';
        message = `Trip #${tripId} has been cancelled.`;
        break;
      default:
        type = NotificationType.TRIP_UPDATED;
        title = 'Trip Updated';
        message = `Trip #${tripId} status changed to ${status}.`;
    }

    await this.notificationsService.create({
      type,
      userId,
      title,
      message,
      data,
      priority,
    });
  }  

  private async handleTripStarted(data: any): Promise<void> {
    await this.handleTripStatusChange({ ...data, status: 'ongoing' });
  }

  private async handleTripCompleted(data: any): Promise<void> {
    await this.handleTripStatusChange({ ...data, status: 'completed' });
  }


}