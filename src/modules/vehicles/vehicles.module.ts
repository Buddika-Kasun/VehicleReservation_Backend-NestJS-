import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdometerLog } from 'src/infra/database/entities/odometer-log.entity';
import { Trip } from 'src/infra/database/entities/trip.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { Vehicle } from 'src/infra/database/entities/vehicle.entity';
import { VehicleController } from './vehicles.controller';
import { VehicleService } from './vehicles.service';
import { ResponseService } from 'src/common/services/response.service';
import { Company } from 'src/infra/database/entities/company.entity';
import { CostConfiguration } from 'src/infra/database/entities/cost-configuration.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle, Trip, OdometerLog, User, Company, CostConfiguration]),
    NotificationsModule
  ],
  controllers: [VehicleController],
  providers: [VehicleService, ResponseService],
  exports: [VehicleService],
})
export class VehicleModule {}