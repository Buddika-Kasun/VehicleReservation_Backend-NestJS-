import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationController } from './validation.controller';
import { Company } from 'src/infra/database/entities/company.entity';
import { Department } from 'src/infra/database/entities/department.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { CostCenter } from 'src/infra/database/entities/cost-center.entity';
import { ValidationService } from './validation.service';
import { ResponseService } from 'src/common/services/response.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Department,
      CostCenter,
      User
    ]),
  ],
  controllers: [ValidationController],
  providers: [ValidationService, ResponseService],
  exports: [ValidationService],
})
export class ValidationModule {}
