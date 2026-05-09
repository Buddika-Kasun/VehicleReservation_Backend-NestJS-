// src/modules/saved-location/saved-location.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedLocation } from 'src/infra/database/entities/saved-location.entity';
import { SavedLocationController } from './saved-location.controller';
import { SavedLocationService } from './saved-location.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedLocation])],
  controllers: [SavedLocationController],
  providers: [SavedLocationService],
  exports: [SavedLocationService],
})
export class SavedLocationModule {}
