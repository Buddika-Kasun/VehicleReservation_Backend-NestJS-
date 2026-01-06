import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from 'src/infra/database/entities/user.entity';
import { Company } from 'src/infra/database/entities/company.entity';
import { ResponseService } from 'src/common/services/response.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Company]),
    NotificationsModule,
  ],
  providers: [UsersService, ResponseService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
