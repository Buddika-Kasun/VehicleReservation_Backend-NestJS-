import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/database/entities/user.entity';
import { ApprovalConfigController } from './approvalConfig.controller';
import { ApprovalConfigService } from './approvalConfig.service';
import { ResponseService } from 'src/common/services/response.service';
import { ApprovalConfig } from 'src/database/entities/approval-configuration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalConfig, User])],
  controllers: [ApprovalConfigController],
  providers: [ApprovalConfigService, ResponseService],
  exports: [ApprovalConfigService],
})
export class ApprovalConfigModule {}
