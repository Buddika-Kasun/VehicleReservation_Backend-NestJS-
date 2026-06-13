import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from 'src/infra/redis/event-bus.service';
import { NotificationsService } from '../notifications.service';
import {
  NotificationType,
  NotificationPriority,
} from 'src/infra/database/entities/notification.entity';
import { EVENTS } from 'src/common/constants/events.constants';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class VehicleNotificationHandler implements OnModuleInit {
  private readonly logger = new Logger(VehicleNotificationHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationsService: NotificationsService,
    private readonly userService: UsersService,
  ) {}

  async onModuleInit() {
    this.eventBus.subscribe(
      EVENTS.VEHICLE.CHECKLIST_SUBMITTED,
      this.handleVehicleChecklistSubmitted.bind(this),
    );
    this.eventBus.subscribe(
      EVENTS.VEHICLE.CHECKLIST_APPROVED,
      this.handleVehicleChecklistApproved.bind(this),
    );
    this.eventBus.subscribe(
      EVENTS.VEHICLE.CHECKLIST_REJECTED,
      this.handleVehicleChecklistRejected.bind(this),
    );

    this.logger.log('VehicleNotificationHandler initialized');
  }

  private async handleVehicleChecklistSubmitted(data: any): Promise<void> {
    const {
      vehicleId,
      vehicleRegNo,
      checkById,
      checkByName,
      checkByRole,
      driverId,
      driverName,
      checklistId,
      checklistDate,
    } = data;

    if (driverId === checkById) {
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_SUBMITTED_FOR_DRIVER,
        userId: String(driverId),
        title: 'Checklist Submitted',
        message: `Your vehicle ${vehicleRegNo} checklist for ${checklistDate} has been submitted by you and is pending approval.`,
        data,
        priority: NotificationPriority.LOW,
      });
    } else {
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_SUBMITTED,
        userId: String(checkById),
        title: 'Checklist Submitted',
        message: `Vehicle ${vehicleRegNo} checklist for ${checklistDate} has been submitted by you and is pending approval.`,
        data,
        priority: NotificationPriority.LOW,
      });

      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_SUBMITTED_FOR_DRIVER,
        userId: String(driverId),
        title: 'Checklist Submitted',
        message: `Your vehicle ${vehicleRegNo} checklist for ${checklistDate} has been submitted by ${checkByName}(${checkByRole}) and is pending approval.`,
        data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    const supervisors = await this.userService.getTransportSupervisors();

    for (const supervisor of supervisors) {
      if (supervisor.id === checkById) continue; // Skip notification to the user who submitted the checklist
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_SUBMITTED,
        userId: String(supervisor.id),
        title: 'New Checklist Submitted',
        message: `${checklistDate} - Checklist for vehicle ${vehicleRegNo} has been submitted by ${checkByName}(${checkByRole}) and is awaiting approval.`,
        data,
        priority: NotificationPriority.HIGH,
      });
    }

    const sysadmin = await this.userService.getSysadmin();

    if (sysadmin.id !== checkById) {
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_SUBMITTED,
        userId: String(sysadmin.id),
        title: 'New Checklist Submitted',
        message: `${checklistDate} - Checklist for vehicle ${vehicleRegNo} has been submitted by ${checkByName}(${checkByRole}) and is awaiting approval.`,
        data,
        priority: NotificationPriority.MEDIUM,
      });
    }
  }

  private async handleVehicleChecklistApproved(data: any): Promise<void> {
    const {
      vehicleId,
      vehicleRegNo,
      approverId,
      approverName,
      approverRole,
      checklistId,
      checklistDate,
      driverId,
      driverName,
    } = data;

    await this.notificationsService.create({
      type: NotificationType.VEHICLE_CHECKLIST_APPROVED,
      userId: String(approverId),
      title: 'Checklist Approved',
      message: `Vehicle ${vehicleRegNo} checklist for ${checklistDate} has been approved by you.`,
      data,
      priority: NotificationPriority.LOW,
    });

    const supervisors = await this.userService.getTransportSupervisors();

    for (const supervisor of supervisors) {
      if (supervisor.id === approverId) continue; // Skip notification to the approver
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_APPROVED,
        userId: String(supervisor.id),
        title: 'Checklist Approved',
        message: `Vehicle ${vehicleRegNo} checklist for ${checklistDate} has been approved by ${approverName}(${approverRole}).`,
        data,
        priority: NotificationPriority.HIGH,
      });
    }

    const sysadmin = await this.userService.getSysadmin();

    if (sysadmin.id !== approverId) {
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_APPROVED,
        userId: String(sysadmin.id),
        title: 'Checklist Approved',
        message: `Vehicle ${vehicleRegNo} checklist for ${checklistDate} has been approved by ${approverName}(${approverRole}).`,
        data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    await this.notificationsService.create({
      type: NotificationType.VEHICLE_CHECKLIST_APPROVED_FOR_DRIVER,
      userId: String(driverId),
      title: 'Checklist Approved',
      message: `Your vehicle ${vehicleRegNo} checklist for ${checklistDate} has been approved by ${approverName}(${approverRole}).`,
      data,
      priority: NotificationPriority.LOW,
    });
  }

  private async handleVehicleChecklistRejected(data: any): Promise<void> {
    const {
      vehicleId,
      vehicleRegNo,
      approverId,
      approverName,
      approverRole,
      checklistId,
      checklistDate,
      driverId,
      driverName,
    } = data;

    await this.notificationsService.create({
      type: NotificationType.VEHICLE_CHECKLIST_REJECTED,
      userId: String(approverId),
      title: 'Checklist Rejected',
      message: `Vehicle ${vehicleRegNo} checklist for ${checklistDate} has been rejected by you.`,
      data,
      priority: NotificationPriority.LOW,
    });

    const supervisors = await this.userService.getTransportSupervisors();

    for (const supervisor of supervisors) {
      if (supervisor.id === approverId) continue; // Skip notification to the approver
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_REJECTED,
        userId: String(supervisor.id),
        title: 'Checklist Rejected',
        message: `Vehicle ${vehicleRegNo} checklist for ${checklistDate} has been rejected by ${approverName}(${approverRole}).`,
        data,
        priority: NotificationPriority.HIGH,
      });
    }

    const sysadmin = await this.userService.getSysadmin();

    if (sysadmin.id !== approverId) {
      await this.notificationsService.create({
        type: NotificationType.VEHICLE_CHECKLIST_REJECTED,
        userId: String(sysadmin.id),
        title: 'Checklist Rejected',
        message: `Vehicle ${vehicleRegNo} checklist for ${checklistDate} has been rejected by ${approverName}(${approverRole}).`,
        data,
        priority: NotificationPriority.MEDIUM,
      });
    }

    await this.notificationsService.create({
      type: NotificationType.VEHICLE_CHECKLIST_REJECTED_FOR_DRIVER,
      userId: String(driverId),
      title: 'Checklist Rejected',
      message: `Your vehicle ${vehicleRegNo} checklist for ${checklistDate} has been rejected by ${approverName}(${approverRole}).`,
      data,
      priority: NotificationPriority.LOW,
    });
  }
}
