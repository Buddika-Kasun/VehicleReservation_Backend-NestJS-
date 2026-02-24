// src/ws/ws.module.ts
import { Module, Global, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NotificationsGateway } from './notification/notification.gateway';
import { TripsGateway } from './trip/trip.gateway';
import { UsersGateway } from './user/user.gateway';
import { DashboardGateway } from './dashboard/dashboard.gateway';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { UsersModule } from 'src/modules/users/users.module';

@Global()
@Module({
  imports: [
    // Import ConfigModule to access environment variables
    ConfigModule.forRoot(),
    
    // Import JwtModule to use JwtService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-default-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
    
    RedisModule,
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationsModule), // Import NotificationsModule if needed
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
    DashboardGateway,
    JwtModule, // Export JwtModule so other modules can use JwtService
  ],
})
export class WsModule {}