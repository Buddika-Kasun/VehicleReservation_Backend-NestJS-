import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { User } from 'src/infra/database/entities/user.entity';
import { Trip } from 'src/infra/database/entities/trip.entity';
import { CostCenter } from 'src/infra/database/entities/cost-center.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Trip, CostCenter]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
