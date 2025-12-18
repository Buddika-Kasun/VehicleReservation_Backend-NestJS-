import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from 'src/infra/database/entities/notification.entity';
import { User } from 'src/infra/database/entities/user.entity';
import { RedisModule } from '../../infra/redis/redis.module';
import { FirebaseModule } from '../../infra/firebase/firebase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    RedisModule,
    FirebaseModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
