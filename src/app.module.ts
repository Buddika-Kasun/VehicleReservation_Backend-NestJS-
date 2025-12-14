import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompanyModule } from './modules/company/company.module';
import { TripsModule } from './modules/trips/trips.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import { JwtModule } from '@nestjs/jwt';
import { CommonModule } from './common/common.module';
import { CostCenterModule } from './modules/costcenter/cost-center.module';
import { DepartmentModule } from './modules/department/department.module';
import { VehicleModule } from './modules/vehicles/vehicles.module';
import { ValidationModule } from './modules/validation/validation.module';
import { ApprovalConfigModule } from './modules/approval/approvalConfig.module';
import { LocationsModule } from './modules/locations/locations.module';
import { RoutesModule } from './modules/routes/routes.module';
import { HealthModule } from './modules/health/health.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from './modules/shared/redis/redis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PubSubModule } from './modules/shared/pubsub/pubsub.module';
import websocketConfig from './config/websocket.config';

@Module({
  imports: [
    // ✅ Global Configuration
    ConfigModule.forRoot({ 
      load: [ appConfig, jwtConfig, websocketConfig],
      isGlobal: true, // Makes configuration available across all modules
      cache: true, // Caches the configuration for better performance
    }),

    // ✅ Event Emitter for internal events
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // ✅ Scheduled Tasks (for notification cleanup)
    ScheduleModule.forRoot(),

    // ✅ Database Configuration (Async to use ConfigService if needed)
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),

    // ✅ JWT Configuration
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),

    // ✅ Redis Module (Global)
    RedisModule,

    // ✅ PubSub Module
    PubSubModule,

    // ✅ Notifications Module
    NotificationsModule, 

    AuthModule,
    UsersModule,
    CompanyModule,
    VehicleModule,
    TripsModule,
    FeedbackModule,
    ReportsModule,
    AuditModule,
    CommonModule,
    CostCenterModule,
    DepartmentModule,
    ValidationModule,
    ApprovalConfigModule,
    LocationsModule,
    RoutesModule,
    HealthModule,
  ],
})
export class AppModule {}
