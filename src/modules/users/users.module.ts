import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from 'src/infra/database/entities/user.entity';
import { Company } from 'src/infra/database/entities/company.entity';
import { ResponseService } from 'src/common/services/response.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApprovalConfigModule } from '../approval/approvalConfig.module';
import { UsersLogService } from './user-log.service';
import { UserActivityLog } from 'src/infra/database/entities/user-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company, UserActivityLog]), NotificationsModule, ApprovalConfigModule],
  providers: [UsersService, ResponseService, UsersLogService],
  controllers: [UsersController],
  exports: [UsersService, UsersLogService],
})
export class UsersModule {}
