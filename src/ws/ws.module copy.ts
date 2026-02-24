import { Module, Global, forwardRef } from '@nestjs/common';
import { NotificationsGateway } from './notification/notification.gateway';
import { TripsGateway } from './trip/trip.gateway';
import { UsersGateway } from './user/user.gateway';
import { DashboardGateway } from './dashboard/dashboard.gateway';
import { RedisModule } from '../infra/redis/redis.module';
import { AuthModule } from '../modules/auth/auth.module';

@Global()
@Module({
  imports: [
    RedisModule,
    forwardRef(() => AuthModule),
  ],
  providers: [
    NotificationsGateway, 
    TripsGateway, 
    UsersGateway, 
    DashboardGateway
  ],
  exports: [
    NotificationsGateway, 
    TripsGateway, 
    UsersGateway, 
    DashboardGateway
  ],
})
export class WsModule {}
