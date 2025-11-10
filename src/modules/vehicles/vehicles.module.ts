import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdometerLog } from 'src/database/entities/odometer-log.entity';
import { Trip } from 'src/database/entities/trip.entity';
import { User } from 'src/database/entities/user.entity';
import { Vehicle } from 'src/database/entities/vehicle.entity';
import { VehicleController } from './vehicles.controller';
import { VehicleService } from './vehicles.service';
import { ResponseService } from 'src/common/services/response.service';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { Company } from 'src/database/entities/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle, Trip, OdometerLog, User, Company]),
  ],
  controllers: [VehicleController, QrController],
  providers: [VehicleService, QrService, ResponseService],
  exports: [VehicleService, QrService],
})
export class VehicleModule {}