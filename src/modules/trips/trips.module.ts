import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from 'src/infra/database/entities/trip.entity';
import { Approval } from 'src/infra/database/entities/approval.entity';
import { OdometerLog } from 'src/infra/database/entities/odometer-log.entity';
import { Vehicle } from 'src/infra/database/entities/vehicle.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { ResponseService } from 'src/common/services/response.service';
import { TripLocation } from 'src/infra/database/entities/trip-location.entity';
import { ApprovalConfig } from 'src/infra/database/entities/approval-configuration.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Schedule } from 'src/infra/database/entities/trip-schedule.entity';
import { VehicleRecommendService } from './vehicleRecommend.service';
import { Department } from 'src/infra/database/entities/department.entity';
import { TripTimelineService } from './trip-timeline.service';
import { TripTimeline } from 'src/infra/database/entities/trip-timeline.entity';
import { ExceedApproval } from 'src/infra/database/entities/exceed-approval.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      Approval,
      ExceedApproval,
      OdometerLog,
      Vehicle,
      User,
      TripLocation,
      ApprovalConfig,
      Schedule,
      Department,
      TripTimeline,
    ]),
    NotificationsModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, VehicleRecommendService, ResponseService, TripTimelineService],
  exports: [TripsService, VehicleRecommendService, TripTimelineService],
})
export class TripsModule {}