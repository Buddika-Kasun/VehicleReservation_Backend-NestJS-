
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/database/entities/company.entity';
import { CostCenter } from 'src/database/entities/cost-center.entity';
import { CostCenterController } from './cost-center.controller';
import { CostCenterService } from './cost-center.service';
import { ResponseService } from 'src/common/services/response.service';

@Module({
  imports: [TypeOrmModule.forFeature([CostCenter, Company])],
  controllers: [CostCenterController],
  providers: [CostCenterService, ResponseService],
  exports: [CostCenterService],
})
export class CostCenterModule {}