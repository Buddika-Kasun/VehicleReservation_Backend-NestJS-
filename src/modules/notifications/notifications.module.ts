import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './services/notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { RedisModule } from '../shared/redis/redis.module';
import { NotificationCleanupService } from './services/notification-cleanup.service';
import { Notification } from 'src/modules/notifications/entities/notification.entity';
import { CleanupController } from './controllers/cleanup.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { AuthModule } from '../auth/auth.module';
import { PubSubModule } from '../shared/pubsub/pubsub.module';
import { UsersModule } from '../users/users.module';
import { UserNotificationsHandler } from './handlers/user-notifications.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    ScheduleModule.forRoot(),
    RedisModule,
    PubSubModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule), 
  ],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationCleanupService,
    UserNotificationsHandler
  ],
  controllers: [
    CleanupController,
    NotificationsController
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}