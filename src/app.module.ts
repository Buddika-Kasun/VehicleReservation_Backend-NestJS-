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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import websocketConfig from './config/websocket.config';
import redisConfig from './config/redis.config';
import { RedisModule } from './infra/redis/redis.module';
import { FirebaseModule } from './infra/firebase/firebase.module';
import { WsModule } from './ws/ws.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ChecklistModule } from './modules/checklist/checklist.module';
import { UpdatesModule } from './modules/updates/updates.module';

@Module({
  imports: [
    // ✅ Global Configuration
    ConfigModule.forRoot({ 
      load: [ appConfig, jwtConfig, websocketConfig, redisConfig ],
      isGlobal: true, // Makes configuration available across all modules
      cache: true, // Caches the configuration for better performance
    }),

    RedisModule, // Move infrastructure to the top
    FirebaseModule,
    WsModule,

    // ✅ Event Emitter for internal events
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 50,
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
    NotificationsModule,
    DashboardModule,
    ChecklistModule,
    UpdatesModule,
  ],
})
export class AppModule {}
