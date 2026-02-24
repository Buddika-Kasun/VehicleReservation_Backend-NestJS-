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
    this.eventBus.subscribe(EVENTS.TRIP.CANCEL, this.handleTripCancelled.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.APPROVE, this.handleTripApproved.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.REJECT, this.handleTripRejected.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.STARTREAD, this.handleTripStartedReading.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.START, this.handleTripStarted.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.FINISH, this.handleTripFinished.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.COMPLETE, this.handleTripEndedReading.bind(this));
    this.eventBus.subscribe(EVENTS.TRIP.STATUS_CHANGE, this.handleTripStatusChange.bind(this));
    
    this.logger.log('TripNotificationHandler initialized');
  }

  private async handleTripCreated(data: any): Promise<void> {
    const { 
      tripId, 
      userId, 
      userName, 
      userRole, 
      passengers 
    } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_CREATED,
      userId,
      title: 'Trip Created',
      message: `Your trip request #${tripId} has been created and is pending approval.`,
      data,
      priority: NotificationPriority.LOW,
    });

    if (passengers && Array.isArray(passengers)) {
      for (const passenger of passengers) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_CREATED,
          userId: String(passenger.id),
          title: 'Trip Created',
          message: `You have been added to trip #${tripId} and are awaiting approval. Please check the trip details.`,
          data,
          priority: NotificationPriority.HIGH,
        });
      }
    }

    const supervisors = await this.userService.getTransportSupervisors();
    
    for (const supervisor of supervisors) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_CREATED_AS_DRAFT,
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

    const supervisors = await this.userService.getTransportSupervisors();
    
    for (const supervisor of supervisors) {
      if (supervisor.id === userId) continue; // Skip if the supervisor is the one who confirmed
      await this.notificationsService.create({
        type: NotificationType.TRIP_CONFIRMED,
        userId: String(supervisor.id),
        title: 'New Trip Confirmed',
        message: `Trip #${tripId} has been confirmed by ${userName}(${userRole}).`,
        data,
        priority: NotificationPriority.HIGH,
      });
    }

    // Create notifications for approvers
    if (approvers && Array.isArray(approvers)) {
      for (const approver of approvers) {
        if (approver && approver.id) {
          await this.notificationsService.create({
            type: NotificationType.TRIP_CONFIRMED_FOR_APPROVAL,
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
    const { tripId, userId, userName, requesterId, passengers } = data;
    
    const supervisors = await this.userService.getTransportSupervisors();
    
    if (String(requesterId) === String(userId)) {
      await this.notificationsService.create({
        // If the requester is cancelling their own trip, no need to notify them againawait this.notificationsService.create({
        type: NotificationType.TRIP_CANCELLED_REQUESTER,
        userId: String(userId),
        title: 'Trip Cancelled',
        message: `Trip #${tripId} has been cancelled by you.`,
        data,
        priority: NotificationPriority.LOW,
      });

    
      for (const supervisor of supervisors) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_CANCELLED_SUPERVISOR,
          userId: String(supervisor.id),
          title: 'Trip Cancelled',
          message: `Trip #${tripId} has been cancelled by ${userName}(REQUESTER).`,
          data,
          priority: NotificationPriority.MEDIUM,
        });
      }

    }
    else {
      await this.notificationsService.create({
        type: NotificationType.TRIP_CANCELLED_SUPERVISOR,
        userId: String(userId),
        title: 'Trip Cancelled',
        message: `Trip #${tripId} has been cancelled by you.`,
        data,
        priority: NotificationPriority.LOW,
      });

      for (const supervisor of supervisors) {
        if (supervisor.id === userId) continue; // Skip if the supervisor is the one who cancelled
        await this.notificationsService.create({
          type: NotificationType.TRIP_CANCELLED_SUPERVISOR,
          userId: String(supervisor.id),
          title: 'Trip Cancelled',
          message: `Trip #${tripId} has been cancelled by ${userName}(TRANSPORT SUPERVISOR).`,
          data,
          priority: NotificationPriority.MEDIUM,
        });
      }

      await this.notificationsService.create({
        type: NotificationType.TRIP_CANCELLED,
        userId: String(requesterId),
        title: 'Trip Cancelled',
        message: `Your trip #${tripId} has been cancelled by ${userName}(TRANSPORT SUPERVISOR).`,
        data,
        priority: NotificationPriority.HIGH,
      });

    }

    if (passengers && Array.isArray(passengers)) {
      for (const passenger of passengers) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_CANCELLED,
          userId: String(passenger.id),
          title: 'Trip Cancelled',
          message: `Trip #${tripId} has been cancelled.`,
          data,
          priority: NotificationPriority.HIGH,
        });
      }
    }

  }

  private async handleTripApproved(data: any): Promise<void> {
    const { tripId, userId, eventData} = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_APPROVED_BY_APPROVER,
      userId: String(userId),
      title: 'Trip Approved',
      message: `Trip #${tripId} has been approved by you.`,
      data: { ...data, eventData },
      priority: NotificationPriority.LOW,
    });

    if (eventData.isApproved && eventData.requesterId) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_APPROVED,
        userId: String(eventData.requesterId),
        title: 'Trip Approved',
        message: `Your trip #${tripId} has been approved.`,
        data: { ...data, eventData },
        priority: NotificationPriority.HIGH,
      });
    }

    if (eventData.isApproved && eventData.passengers && Array.isArray(eventData.passengers)) {
    
      for (const passenger of eventData.passengers) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_APPROVED,
          userId: String(passenger.id),
          title: 'Trip Approved',
          message: `Trip #${tripId} who you are a passenger has been approved. Please be prepared and go on time.`,
          data,
          priority: NotificationPriority.HIGH,
        });
      }
    }

    if (eventData.isApproved && eventData.driverId) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_APPROVED_FOR_DRIVER,
        userId: String(eventData.driverId),
        title: 'New Trip Approved',
        message: `You have been assigned as driver for trip #${tripId}, which has been approved. Please be prepared for meter reading and commencement.`,
        data: { ...data, eventData },
        priority: NotificationPriority.HIGH,
      });
    }

    if (eventData.isApproved) {
      const securities = await this.userService.getSecurities();
    
      for (const security of securities) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_APPROVED_FOR_SECURITY,
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
      rejectionReason,
      passengers, 
    } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_REJECTED_BY_APPROVER,
      userId: String(userId),
      title: 'Trip Rejected',
      message: `Trip #${tripId} has been rejected by you.`,
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

    if (passengers && Array.isArray(passengers)) {
    
      for (const passenger of passengers) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_REJECTED,
          userId: String(passenger.id),
          title: 'Trip Rejected',
          message: `Trip #${tripId} who you are a passenger has been rejected. Please check the trip details.`,
          data,
          priority: NotificationPriority.HIGH,
        });
      }
    }

    if (userId !== approval1Id) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_REJECTED_BY_APPROVER,
        userId: String(approval1Id),
        title: 'Trip Rejected',
        message: `Trip #${tripId} has been rejected by ${userName}(${userRole}), Reason: ${rejectionReason}`,
        data: data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    if (userId !== approval2Id) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_REJECTED_BY_APPROVER,
        userId: String(approval2Id),
        title: 'Trip Rejected',
        message: `Trip #${tripId} has been rejected by ${userName}(${userRole}), Reason: ${rejectionReason}`,
        data: data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    if (userId !== safetyApproverId) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_REJECTED_BY_APPROVER,
        userId: String(safetyApproverId),
        title: 'Trip Rejected',
        message: `Trip #${tripId} has been rejected by ${userName}(${userRole}), Reason: ${rejectionReason}`,
        data: data,
        priority: NotificationPriority.MEDIUM,
      });
    }

  }

  private async handleTripStartedReading(data: any): Promise<void> {
    const { 
      tripId, 
      userId,
      userName,
      requesterId,
      passengers,
      driverId,
    } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_READING_START,
      userId: String(userId),
      title: 'Trip Started Odometer Meter Read',
      message: `Trip #${tripId} start odometer read by you.`,
      data,
      priority: NotificationPriority.LOW,
    });

    const securities = await this.userService.getSecurities();
    for (const security of securities) {
      if (security.id === userId) continue; // Skip if the security is the one who started the reading
      await this.notificationsService.create({
        type: NotificationType.TRIP_READING_START,
        userId: String(security.id),
        title: 'Trip Started Odometer Meter Read',
        message: `Trip #${tripId} start odometer read by ${userName}(Security).`,
        data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    await this.notificationsService.create({
      type: NotificationType.TRIP_READING_START_FOR_PASSENGER,
      userId: String(requesterId),
      title: 'Trip Ready to Start',
      message: `Your trip #${tripId} is ready to start. Start odometer meter reading has been taken by ${userName}(Security).`,
      data,
      priority: NotificationPriority.HIGH,
    });

    if (passengers && Array.isArray(passengers)) {
      for (const passenger of passengers) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_READING_START_FOR_PASSENGER,
          userId: String(passenger.id),
          title: 'Trip Ready to Start',
          message: `Trip #${tripId} who you are a passenger is ready to start. Please be prepared and go on time.`,
          data,
          priority: NotificationPriority.HIGH,
        });
      }
    }

      await this.notificationsService.create({
        type: NotificationType.TRIP_READING_START_FOR_DRIVER,
        userId: String(driverId),
        title: 'Trip Ready to Start',
        message: `You have been assigned as driver for trip #${tripId}, Start odometer meter reading has been taken by ${userName}(Security). Please be prepared for commencement.`,
        data,
        priority: NotificationPriority.HIGH,
      });

  }

  private async handleTripStarted(data: any): Promise<void> {
    const { 
      tripId, 
      userId,
      userRole,
      userName,
      requesterId,
      passengers,
    } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_STARTED,
      userId: String(userId),
      title: 'Trip Started',
      message: `Trip #${tripId} has been started by you.`,
      data,
      priority: NotificationPriority.LOW,
    });

    await this.notificationsService.create({
      type: NotificationType.TRIP_STARTED_FOR_PASSENGER,
      userId: String(requesterId),
      title: 'Trip Started',
      message: `Your trip #${tripId} has been started by ${userName}(${userRole}).`,
      data,
      priority: NotificationPriority.HIGH,
    });

    if (passengers && Array.isArray(passengers)) {
      for (const passenger of passengers) {
        await this.notificationsService.create({
          type: NotificationType.TRIP_STARTED_FOR_PASSENGER,
          userId: String(passenger.id),
          title: 'Trip Started',
          message: `Trip #${tripId} who you are a passenger is started by ${userName}(${userRole}).`,
          data,
          priority: NotificationPriority.HIGH,
        });
      }
    }

    const supervisors = await this.userService.getTransportSupervisors();
    
    for (const supervisor of supervisors) {
      if (supervisor.id === userId) continue; // Skip if the supervisor is the one who confirmed
      await this.notificationsService.create({
        type: NotificationType.TRIP_STARTED_FOR_SUPERVISOR,
        userId: String(supervisor.id),
        title: 'Trip Started',
        message: `Trip #${tripId} has been started by ${userName}(${userRole}).`,
        data,
        priority: NotificationPriority.LOW,
      });
    }

  }

  private async handleTripFinished(data: any): Promise<void> {
    const { 
      tripId, 
      userId,
      userRole,
      userName,
      requesterId,
    } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_FINISHED,
      userId: String(userId),
      title: 'Trip Ended',
      message: `Trip #${tripId} has been ended by you. Please proceed to take the ending odometer meter reading.`,
      data,
      priority: NotificationPriority.LOW,
    });

    await this.notificationsService.create({
      type: NotificationType.TRIP_FINISHED_FOR_REQUESTER,
      userId: String(requesterId),
      title: 'Trip Ended',
      message: `Your trip #${tripId} has been ended by ${userName}(${userRole}).`,
      data,
      priority: NotificationPriority.HIGH,
    });

    const supervisors = await this.userService.getTransportSupervisors();
    for (const supervisor of supervisors) {
      if (supervisor.id === userId) continue; // Skip if the supervisor is the one who confirmed
      await this.notificationsService.create({
        type: NotificationType.TRIP_FINISHED_FOR_SUPERVISOR,
        userId: String(supervisor.id),
        title: 'Trip Ended',
        message: `Trip #${tripId} has been ended by ${userName}(${userRole}).`,
        data,
        priority: NotificationPriority.LOW,
      });
    }

    const securities = await this.userService.getSecurities();
    for (const security of securities) {
      await this.notificationsService.create({
        type: NotificationType.TRIP_FINISHED_FOR_SECURITY,
        userId: String(security.id),
        title: 'Trip Ended',
        message: `Trip #${tripId} has been ended by ${userName}(${userRole}). Please proceed to take the ending odometer meter reading.`,
        data,
        priority: NotificationPriority.HIGH,
      });
    }

  }

  private async handleTripEndedReading(data: any): Promise<void> {
    const { 
      tripId, 
      userId,
      userName,
      requesterId,
      driverId,
    } = data;
    
    await this.notificationsService.create({
      type: NotificationType.TRIP_COMPLETED,
      userId: String(userId),
      title: 'Trip Ended Odometer Meter Read',
      message: `Trip #${tripId} end odometer read by you and the trip is now completed.`,
      data,
      priority: NotificationPriority.LOW,
    });

    const securities = await this.userService.getSecurities();
    for (const security of securities) {
      if (security.id === userId) continue; // Skip if the security is the one who started the reading
      await this.notificationsService.create({
        type: NotificationType.TRIP_COMPLETED,
        userId: String(security.id),
        title: 'Trip Ended Odometer Meter Read',
        message: `Trip #${tripId} end odometer read by ${userName}(Security) and the trip is now completed.`,
        data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    await this.notificationsService.create({
      type: NotificationType.TRIP_COMPLETED_FOR_REQUESTER,
      userId: String(requesterId),
      title: 'Trip Completed',
      message: `Your trip #${tripId} is completed. End odometer meter reading has been taken by ${userName}(Security) and the trip is now completed.`,
      data,
      priority: NotificationPriority.HIGH,
    });

    await this.notificationsService.create({
      type: NotificationType.TRIP_COMPLETED_FOR_DRIVER,
      userId: String(driverId),
      title: 'Trip Completed',
      message: `You have been assigned as driver for trip #${tripId}, End odometer meter reading has been taken by ${userName}(Security), and the trip is now completed.`,
      data,
      priority: NotificationPriority.HIGH,
    });

    const supervisors = await this.userService.getTransportSupervisors();
    for (const supervisor of supervisors) {
      if (supervisor.id === userId) continue; // Skip if the supervisor is the one who confirmed
      await this.notificationsService.create({
        type: NotificationType.TRIP_COMPLETED_FOR_SUPERVISOR,
        userId: String(supervisor.id),
        title: 'Trip Completed',
        message: `Trip #${tripId} has been completed by ${userName}(Security) by taking the end odometer reading and the trip is now completed.`,
        data,
        priority: NotificationPriority.LOW,
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

}