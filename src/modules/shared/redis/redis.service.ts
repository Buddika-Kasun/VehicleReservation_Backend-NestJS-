import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private publisher: RedisClientType;
  private subscriber: RedisClientType;

  constructor(private configService: ConfigService) {
    this.initialize();
  }

  private async initialize() {
    try {
      const redisUrl = this.configService.get('redis.url') || process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.logger.log(`Connecting to Redis: ${redisUrl?.replace(/:[^:@]*@/, ':****@')}`);
      
      this.publisher = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl?.includes('rediss://'),
          reconnectStrategy: (retries) => {
            this.logger.warn(`Redis reconnection attempt ${retries}`);
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.subscriber = this.publisher.duplicate();

      // Handle connection events
      this.publisher.on('error', (err) => {
        this.logger.error('Redis Publisher Error:', err.message);
      });

      this.publisher.on('connect', () => {
        this.logger.log('Redis Publisher connected');
      });

      this.subscriber.on('error', (err) => {
        this.logger.error('Redis Subscriber Error:', err.message);
      });

      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);

      this.logger.log('Redis connection established successfully');
      
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error.message);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  async publish(channel: string, message: any) {
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
      this.logger.debug(`Published to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}:`, error.message);
      throw error;
    }
  }

  async subscribe(channel: string, callback: (message: any) => void) {
    try {
      await this.subscriber.subscribe(channel, (message) => {
        try {
          callback(JSON.parse(message));
        } catch (error) {
          this.logger.error(`Error parsing message from ${channel}:`, error.message);
        }
      });
      this.logger.debug(`Subscribed to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}:`, error.message);
      throw error;
    }
  }

  async set(key: string, value: any, ttl?: number) {
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        await this.publisher.setEx(key, ttl, stringValue);
      } else {
        await this.publisher.set(key, stringValue);
      }
      this.logger.debug(`Set key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error.message);
      throw error;
    }
  }

  async get(key: string): Promise<any> {
    try {
      const value = await this.publisher.get(key) as string | null;
      this.logger.debug(`Get key: ${key}`);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error.message);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.publisher.del(key);
      this.logger.debug(`Deleted key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error.message);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.publisher.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error.message);
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.publisher.expire(key, ttl);
      this.logger.debug(`Set expire for key: ${key} (${ttl}s)`);
    } catch (error) {
      this.logger.error(`Failed to set expire for key ${key}:`, error.message);
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.publisher.keys(pattern);
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern ${pattern}:`, error.message);
      throw error;
    }
  }

  async subscribePattern(
    pattern: string,
    callback: (message: any) => void,
  ): Promise<void> {
    try {
      await this.subscriber.pSubscribe(pattern, (message, channel) => {
        try {
          callback({ message: JSON.parse(message), channel });
        } catch (error) {
          this.logger.error(`Error parsing pattern message from ${channel}:`, error.message);
        }
      });
      this.logger.debug(`Subscribed to pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to pattern ${pattern}:`, error.message);
      throw error;
    }
  }

  async unsubscribePattern(pattern: string): Promise<void> {
    try {
      await this.subscriber.pUnsubscribe(pattern);
      this.logger.debug(`Unsubscribed from pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from pattern ${pattern}:`, error.message);
      throw error;
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
      this.logger.debug(`Unsubscribed from channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from channel ${channel}:`, error.message);
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.publisher.incr(key);
    } catch (error) {
      this.logger.error(`Failed to increment key ${key}:`, error.message);
      throw error;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.publisher.decr(key);
    } catch (error) {
      this.logger.error(`Failed to decrement key ${key}:`, error.message);
      throw error;
    }
  }

  async hSet(key: string, field: string, value: any): Promise<void> {
    try {
      await this.publisher.hSet(key, field, JSON.stringify(value));
      this.logger.debug(`HSet key: ${key}, field: ${field}`);
    } catch (error) {
      this.logger.error(`Failed to hSet ${key}.${field}:`, error.message);
      throw error;
    }
  }

  async hGet(key: string, field: string): Promise<any> {
    try {
      const value = await this.publisher.hGet(key, field) as string;
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to hGet ${key}.${field}:`, error.message);
      throw error;
    }
  }

  async hGetAll(key: string): Promise<Record<string, any>> {
    try {
      const result = await this.publisher.hGetAll(key);
      const parsedResult: Record<string, any> = {};
      
      for (const [field, value] of Object.entries(result)) {
        try {
          parsedResult[field] = JSON.parse(value);
        } catch {
          parsedResult[field] = value;
        }
      }
      
      return parsedResult;
    } catch (error) {
      this.logger.error(`Failed to hGetAll ${key}:`, error.message);
      throw error;
    }
  }

  async sAdd(key: string, members: any[]): Promise<void> {
    try {
      const stringMembers = members.map(member => JSON.stringify(member));
      await this.publisher.sAdd(key, stringMembers);
      this.logger.debug(`SAdd key: ${key}, members: ${members.length}`);
    } catch (error) {
      this.logger.error(`Failed to sAdd to ${key}:`, error.message);
      throw error;
    }
  }

  async sMembers(key: string): Promise<any[]> {
    try {
      const members = await this.publisher.sMembers(key);
      return members.map(member => JSON.parse(member));
    } catch (error) {
      this.logger.error(`Failed to get sMembers from ${key}:`, error.message);
      throw error;
    }
  }

  async lPush(key: string, values: any[]): Promise<void> {
    try {
      const stringValues = values.map(value => JSON.stringify(value));
      await this.publisher.lPush(key, stringValues);
      this.logger.debug(`LPush key: ${key}, values: ${values.length}`);
    } catch (error) {
      this.logger.error(`Failed to lPush to ${key}:`, error.message);
      throw error;
    }
  }

  async lRange(key: string, start: number, end: number): Promise<any[]> {
    try {
      const values = await this.publisher.lRange(key, start, end);
      return values.map(value => JSON.parse(value));
    } catch (error) {
      this.logger.error(`Failed to lRange ${key}:`, error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.publisher.quit();
      await this.subscriber.quit();
      this.logger.log('Redis connections closed');
    } catch (error) {
      this.logger.error('Error closing Redis connections:', error.message);
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.publisher.ping();
    } catch (error) {
      this.logger.error('Redis ping failed:', error.message);
      throw error;
    }
  }

  async getConnectionInfo(): Promise<{
    isConnected: boolean;
    url: string;
    timestamp: string;
  }> {
    try {
      await this.publisher.ping();
      const redisUrl = this.configService.get('redis.url') || process.env.REDIS_URL || 'redis://localhost:6379';
      
      return {
        isConnected: true,
        url: redisUrl?.replace(/:[^:@]*@/, ':****@'),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        isConnected: false,
        url: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}