
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { Company } from '../../database/entities/company.entity';
import { CostConfigurationController } from './cost-configuration.controller';
import { CostConfiguration } from 'src/database/entities/cost-configuration.entity';
import { ResponseService } from 'src/common/services/response.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CostConfiguration
    ])
  ],
  controllers: [
    CompanyController,
    CostConfigurationController
  ],
  providers: [CompanyService, ResponseService],
  exports: [CompanyService]
})
export class CompanyModule {}