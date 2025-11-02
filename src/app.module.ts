import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompanyModule } from './modules/company/company.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { TripsModule } from './modules/trips/trips.module';
import { OdometerModule } from './modules/odometer/odometer.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import { JwtModule } from '@nestjs/jwt';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    // ✅ Global Configuration
    ConfigModule.forRoot({ 
      load: [ appConfig, jwtConfig],
      isGlobal: true, // Makes configuration available across all modules
      cache: true, // Caches the configuration for better performance
    }),

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
    VehiclesModule,
    TripsModule,
    OdometerModule,
    FeedbackModule,
    ReportsModule,
    AuditModule,
    CommonModule
  ],
})
export class AppModule {}
