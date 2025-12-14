import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { RedisModule } from '../shared/redis/redis.module';
import { HealthController } from './health.controller';

@Module({
  imports: [RedisModule],
  providers: [HealthService],
  exports: [HealthService],
  controllers: [HealthController],
})
export class HealthModule {}