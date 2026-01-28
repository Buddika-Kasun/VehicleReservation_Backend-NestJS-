// src/modules/checklist/checklist.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { Checklist } from 'src/infra/database/entities/checklist.entity';
import { Vehicle } from 'src/infra/database/entities/vehicle.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { ChecklistItem } from 'src/infra/database/entities/checklist-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Checklist, ChecklistItem, Vehicle, User]),
  ],
  controllers: [ChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}