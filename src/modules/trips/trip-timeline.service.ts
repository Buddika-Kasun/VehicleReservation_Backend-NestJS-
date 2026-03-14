// src/modules/trips/services/trip-timeline.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SriLankaTimeUtil } from 'src/common/utils/sri-lanka-time.util';
import { TripTimeline } from 'src/infra/database/entities/trip-timeline.entity';
import { Trip } from 'src/infra/database/entities/trip.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TripTimelineService {
  constructor(
    @InjectRepository(TripTimeline)
    private readonly timelineRepo: Repository<TripTimeline>,
  ) {}

  // Helper method to ensure timeline exists
  private async ensureTimelineExists(tripId: number): Promise<TripTimeline> {
    let timeline = await this.timelineRepo.findOne({
      where: { tripId },
      relations: [
        'createdBy',
        'cancelledBy',
        'vehicleAssignedBy',
        'vehicleChangedBy',
        'confirmedBy',
        'approval1By',
        'approval2By',
        'safetyApprovalBy',
        'rejectedBy',
        'startMeterReadingBy',
        'endMeterReadingBy',
        'driverStartedBy',
        'driverEndedBy',
      ],
    });

    // If no timeline exists, create a basic one
    if (!timeline) {
      console.log(`No timeline found for trip ${tripId}, creating new timeline...`);

      // Get trip details to create timeline
      const trip = await this.timelineRepo.manager.getRepository(Trip).findOne({
        where: { id: tripId },
        relations: ['requester'],
      });

      if (!trip) {
        throw new Error(`Trip ${tripId} not found`);
      }

      const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());
      const tripDateTime = SriLankaTimeUtil.formatDateTimeForDisplay(
        SriLankaTimeUtil.combineDateTime(trip.startDate.toString(), trip.startTime),
      );

      const newTimeline = this.timelineRepo.create({
        trip,
        tripId: trip.id,
        //createdAt: now,
        createdBy: trip.requester,
        createdById: trip.requester?.id,
        currentStatus: trip.status,
        tripDateTime,
      });

      timeline = await this.timelineRepo.save(newTimeline);
      console.log(`Created new timeline for trip ${tripId}`);
    }

    return timeline;
  }

  async initializeTimeline(trip: Trip, createdBy: User): Promise<TripTimeline> {
    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());
    const tripDateTime = SriLankaTimeUtil.formatDateTimeForDisplay(
      SriLankaTimeUtil.combineDateTime(trip.startDate.toString(), trip.startTime),
    );

    const timeline = this.timelineRepo.create({
      trip,
      tripId: trip.id,
      createdAt: now,
      createdBy,
      createdById: createdBy.id,
      currentStatus: 'draft',
      tripDateTime,
    });

    return this.timelineRepo.save(timeline);
  }

  // Record vehicle assignment
  async recordVehicleAssignment(
    tripId: number,
    assignedBy: User,
    isChange: boolean = false,
  ): Promise<TripTimeline> {
    // Ensure timeline exists first
    await this.ensureTimelineExists(tripId);

    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());

    const updates: Partial<TripTimeline> = isChange
      ? {
          vehicleChangedAt: now,
          vehicleChangedBy: assignedBy,
          vehicleChangedById: assignedBy.id,
        }
      : {
          vehicleAssignedAt: now,
          vehicleAssignedBy: assignedBy,
          vehicleAssignedById: assignedBy.id,
        };

    await this.timelineRepo.update({ tripId }, updates);
    return this.getTimeline(tripId);
  }

  // Record confirmation
  async recordConfirmation(tripId: number, confirmedBy: User): Promise<TripTimeline> {
    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());

    await this.timelineRepo.update(
      { tripId },
      {
        confirmedAt: now,
        confirmedBy,
        confirmedById: confirmedBy.id,
        currentStatus: 'pending',
      },
    );

    return this.getTimeline(tripId);
  }

  // Record approval
  async recordApproval(
    trip: Trip,
    approvedBy: User,
    level: 1 | 2 | 'safety' | 'all',
  ): Promise<TripTimeline> {
    // Ensure timeline exists first
    await this.ensureTimelineExists(trip.id);

    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());
    const updates: Partial<TripTimeline> = {};

    if (level === 1) {
      updates.approval1At = now;
      updates.approval1By = approvedBy;
      updates.approval1ById = approvedBy.id;
    } else if (level === 2) {
      updates.approval2At = now;
      updates.approval2By = approvedBy;
      updates.approval2ById = approvedBy.id;
    } else if (level === 'safety') {
      updates.safetyApprovalAt = now;
      updates.safetyApprovalBy = approvedBy;
      updates.safetyApprovalById = approvedBy.id;
    } else if (level === 'all') {
      updates.approval1At = now;
      updates.approval1By = approvedBy;
      updates.approval1ById = approvedBy.id;
      updates.approval2At = now;
      updates.approval2By = approvedBy;
      updates.approval2ById = approvedBy.id;
      updates.safetyApprovalAt = now;
      updates.safetyApprovalBy = approvedBy;
      updates.safetyApprovalById = approvedBy.id;
    }
    updates.currentStatus = trip.status;

    await this.timelineRepo.update({ tripId: trip.id }, updates);
    return this.getTimeline(trip.id);
  }

  // Record rejection
  async recordRejection(
    tripId: number, 
    rejectedBy: User
  ): Promise<TripTimeline> {
    // Ensure timeline exists first
    await this.ensureTimelineExists(tripId);

    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());

    await this.timelineRepo.update(
      { tripId },
      {
        rejectedAt: now,
        rejectedBy,
        rejectedById: rejectedBy.id,
        currentStatus: 'rejected',
      },
    );

    return this.getTimeline(tripId);
  }

  // Record cancellation
  async recordCancellation(
    tripId: number, 
    cancelledBy: User
  ): Promise<TripTimeline> {
    // Ensure timeline exists first
    await this.ensureTimelineExists(tripId);

    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());

    await this.timelineRepo.update(
      { tripId },
      {
        cancelledAt: now,
        cancelledBy,
        cancelledById: cancelledBy.id,
        currentStatus: 'cancelled',
      },
    );

    return this.getTimeline(tripId);
  }

  // Record meter reading
  async recordMeterReading(
    tripId: number,
    recordedBy: User,
    type: 'start' | 'end',
  ): Promise<TripTimeline> {
    // Ensure timeline exists first
    await this.ensureTimelineExists(tripId);

    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());

    const updates: Partial<TripTimeline> =
      type === 'start'
        ? {
            startMeterReadingAt: now,
            startMeterReadingBy: recordedBy,
            startMeterReadingById: recordedBy.id,
            currentStatus: 'read',
          }
        : {
            endMeterReadingAt: now,
            endMeterReadingBy: recordedBy,
            endMeterReadingById: recordedBy.id,
            currentStatus: 'completed',
          };

    await this.timelineRepo.update({ tripId }, updates);
    return this.getTimeline(tripId);
  }

  // Record driver action
  async recordDriverAction(
    tripId: number,
    driver: User,
    action: 'start' | 'end',
  ): Promise<TripTimeline> {
    // Ensure timeline exists first
    await this.ensureTimelineExists(tripId);

    const now = SriLankaTimeUtil.formatDateTimeForDisplay(new Date());

    const updates: Partial<TripTimeline> =
      action === 'start'
        ? {
            driverStartedAt: now,
            driverStartedBy: driver,
            driverStartedById: driver.id,
            currentStatus: 'ongoing',
          }
        : {
            driverEndedAt: now,
            driverEndedBy: driver,
            driverEndedById: driver.id,
            currentStatus: 'finished',
          };

    await this.timelineRepo.update({ tripId }, updates);
    return this.getTimeline(tripId);
  }

  // Update status
  async updateStatus(tripId: number, newStatus: string): Promise<TripTimeline> {
    await this.timelineRepo.update({ tripId }, { currentStatus: newStatus });
    return this.getTimeline(tripId);
  }

  // Get timeline with all user relations
  async getTimeline(tripId: number): Promise<TripTimeline> {
    return this.timelineRepo.findOne({
      where: { tripId },
      relations: [
        'createdBy',
        'cancelledBy',
        'vehicleAssignedBy',
        'vehicleChangedBy',
        'confirmedBy',
        'approval1By',
        'approval2By',
        'safetyApprovalBy',
        'rejectedBy',
        'startMeterReadingBy',
        'endMeterReadingBy',
        'driverStartedBy',
        'driverEndedBy',
      ],
    });
  }

  // Get formatted timeline for API response
  async getFormattedTimeline(tripId: number): Promise<any> {
    const timeline = await this.getTimeline(tripId);

    if (!timeline) {
      return null;
    }

    return {
      tripId: timeline.tripId,
      currentStatus: timeline.currentStatus,
      tripDateTime: timeline.tripDateTime,

      creation: {
        at: timeline.createdAt,
        by: timeline.createdBy
          ? {
              id: timeline.createdBy.id,
              name: timeline.createdBy.displayname,
              username: timeline.createdBy.username,
            }
          : null,
      },

      cancellation: timeline.cancelledAt
        ? {
            at: timeline.cancelledAt,
            by: timeline.cancelledBy
              ? {
                  id: timeline.cancelledBy.id,
                  name: timeline.cancelledBy.displayname,
                }
              : null,
          }
        : null,

      vehicle: {
        assigned: timeline.vehicleAssignedAt
          ? {
              at: timeline.vehicleAssignedAt,
              by: timeline.vehicleAssignedBy
                ? {
                    id: timeline.vehicleAssignedBy.id,
                    name: timeline.vehicleAssignedBy.displayname,
                  }
                : null,
            }
          : null,
        changed: timeline.vehicleChangedAt
          ? {
              at: timeline.vehicleChangedAt,
              by: timeline.vehicleChangedBy
                ? {
                    id: timeline.vehicleChangedBy.id,
                    name: timeline.vehicleChangedBy.displayname,
                  }
                : null,
            }
          : null,
      },

      confirmation: timeline.confirmedAt
        ? {
            at: timeline.confirmedAt,
            by: timeline.confirmedBy
              ? {
                  id: timeline.confirmedBy.id,
                  name: timeline.confirmedBy.displayname,
                }
              : null,
          }
        : null,

      approvals: {
        level1: timeline.approval1At
          ? {
              at: timeline.approval1At,
              by: timeline.approval1By
                ? {
                    id: timeline.approval1By.id,
                    name: timeline.approval1By.displayname,
                  }
                : null,
            }
          : null,
        level2: timeline.approval2At
          ? {
              at: timeline.approval2At,
              by: timeline.approval2By
                ? {
                    id: timeline.approval2By.id,
                    name: timeline.approval2By.displayname,
                  }
                : null,
            }
          : null,
        safety: timeline.safetyApprovalAt
          ? {
              at: timeline.safetyApprovalAt,
              by: timeline.safetyApprovalBy
                ? {
                    id: timeline.safetyApprovalBy.id,
                    name: timeline.safetyApprovalBy.displayname,
                  }
                : null,
            }
          : null,
      },

      rejection: timeline.rejectedAt
        ? {
            at: timeline.rejectedAt,
            by: timeline.rejectedBy
              ? {
                  id: timeline.rejectedBy.id,
                  name: timeline.rejectedBy.displayname,
                }
              : null,
          }
        : null,

      meterReadings: {
        start: timeline.startMeterReadingAt
          ? {
              at: timeline.startMeterReadingAt,
              by: timeline.startMeterReadingBy
                ? {
                    id: timeline.startMeterReadingBy.id,
                    name: timeline.startMeterReadingBy.displayname,
                  }
                : null,
            }
          : null,
        end: timeline.endMeterReadingAt
          ? {
              at: timeline.endMeterReadingAt,
              by: timeline.endMeterReadingBy
                ? {
                    id: timeline.endMeterReadingBy.id,
                    name: timeline.endMeterReadingBy.displayname,
                  }
                : null,
            }
          : null,
      },

      driver: {
        started: timeline.driverStartedAt
          ? {
              at: timeline.driverStartedAt,
              by: timeline.driverStartedBy
                ? {
                    id: timeline.driverStartedBy.id,
                    name: timeline.driverStartedBy.displayname,
                  }
                : null,
            }
          : null,
        ended: timeline.driverEndedAt
          ? {
              at: timeline.driverEndedAt,
              by: timeline.driverEndedBy
                ? {
                    id: timeline.driverEndedBy.id,
                    name: timeline.driverEndedBy.displayname,
                  }
                : null,
            }
          : null,
      },
    };
  }
}
