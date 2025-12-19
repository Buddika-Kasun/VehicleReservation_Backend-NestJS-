import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from 'src/infra/database/entities/notification.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { RedisModule } from '../../infra/redis/redis.module';
import { FirebaseModule } from '../../infra/firebase/firebase.module';
import { UserNotificationHandler } from './handlers/user-notification.handler';
import { TripNotificationHandler } from './handlers/trip-notification.handler';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    RedisModule,
    FirebaseModule,
    forwardRef(() => UsersModule)
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    UserNotificationHandler,
    TripNotificationHandler,
    //UsersService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
