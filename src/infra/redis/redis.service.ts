import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('redis.url');
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    if (url) {
      this.logger.log(`Connecting to Redis using URL...`);
      this.client = new Redis(url, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    } else {
      this.logger.log(`Connecting to Redis at ${host}:${port}...`);
      this.client = new Redis({
        host,
        port,
        password,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    }

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
