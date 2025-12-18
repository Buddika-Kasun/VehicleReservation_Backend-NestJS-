
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/infra/database/entities/company.entity';
import { CostCenter } from 'src/infra/database/entities/cost-center.entity';
import { Department } from 'src/infra/database/entities/department.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { ResponseService } from 'src/common/services/response.service';

@Module({
  imports: [TypeOrmModule.forFeature([CostCenter, Department, Company, User])],
  controllers: [DepartmentController],
  providers: [DepartmentService, ResponseService],
  exports: [DepartmentService],
})
export class DepartmentModule {}