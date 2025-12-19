import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
  providers: [RedisService, EventBusService],
  exports: [RedisService, EventBusService],
})
export class RedisModule {}
