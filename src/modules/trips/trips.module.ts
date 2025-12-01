import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Trip } from 'src/database/entities/trip.entity';
import { Approval } from 'src/database/entities/approval.entity';
import { OdometerLog } from 'src/database/entities/odometer-log.entity';
import { Vehicle } from 'src/database/entities/vehicle.entity';
import { User } from 'src/database/entities/user.entity';
import { ResponseService } from 'src/common/services/response.service';
import { TripLocation } from 'src/database/entities/trip-location.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Approval, OdometerLog, Vehicle, User, TripLocation]),
  ],
  controllers: [TripsController],
  providers: [TripsService, ResponseService],
  exports: [TripsService],
})
export class TripsModule {}