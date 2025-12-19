import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from 'src/infra/redis/event-bus.service';
import { NotificationsService } from '../notifications.service';
import { NotificationType, NotificationPriority } from 'src/infra/database/entities/notification.entity';
import { EVENTS } from 'src/common/constants/events.constants';

@Injectable()
export class TripNotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(TripNotificationHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.eventBus.subscribe(EVENTS.TRIP.CREATE, this.handleTripCreated.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.STATUS_CHANGE, this.handleTripStatusChange.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.APPROVE, this.handleTripApproved.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.REJECT, this.handleTripRejected.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.START, this.handleTripStarted.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.COMPLETE, this.handleTripCompleted.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.CANCEL, this.handleTripCancelled.bind(this));
    
    this.logger.log('TripNotificationHandler initialized');
  }

  private async handleTripCreated(data: any): Promise<void> {
    const { tripId, userId } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_CREATED,
      userId,
      title: 'Trip Created',
      message: `Your trip request #${tripId} has been created and is pending approval.`,
      data,
      priority: NotificationPriority.MEDIUM,
    });
  }

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

  private async handleTripApproved(data: any): Promise<void> {
    await this.handleTripStatusChange({ ...data, status: 'approved' });
  }

  private async handleTripRejected(data: any): Promise<void> {
    await this.handleTripStatusChange({ ...data, status: 'rejected' });
  }

  private async handleTripStarted(data: any): Promise<void> {
    await this.handleTripStatusChange({ ...data, status: 'ongoing' });
  }

  private async handleTripCompleted(data: any): Promise<void> {
    await this.handleTripStatusChange({ ...data, status: 'completed' });
  }

  private async handleTripCancelled(data: any): Promise<void> {
    await this.handleTripStatusChange({ ...data, status: 'cancelled' });
  }
}