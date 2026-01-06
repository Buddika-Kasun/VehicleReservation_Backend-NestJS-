// src/infra/redis/redis.service.ts - Fixing the subscribe method
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
    const db = this.configService.get<number>('redis.db', 0);
    const tls = this.configService.get<boolean>('redis.tls', false);

    const options: any = {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
      db,
    };

    if (tls) {
      options.tls = {};
    }

    if (password) {
      options.password = password;
    }

    if (url) {
      this.logger.log(`Connecting to Redis using URL...`);
      this.client = new Redis(url, options);
    } else {
      this.logger.log(`Connecting to Redis at ${host}:${port}...`);
      this.client = new Redis({
        host,
        port,
        ...options,
      });
    }

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis ready to accept commands');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    this.client.on('end', () => {
      this.logger.log('Redis connection ended');
    });
  }

  /**
   * Get the Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get a duplicate of the Redis client (for pub/sub)
   */
  getDuplicateClient(): Redis {
    return this.client.duplicate();
  }

  /**
   * Health check for Redis
   */
  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
      throw error;
    }
  }

  /**
   * Set a key-value pair with optional expiry
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      
      if (!value) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set expiry for a key
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      this.logger.error(`Failed to set expiry for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment a key
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Failed to increment key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Decrement a key
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error(`Failed to decrement key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Publish to a channel
   */
  async publish(channel: string, message: string | object): Promise<number> {
    try {
      const payload = typeof message === 'object' ? JSON.stringify(message) : message;
      return await this.client.publish(channel, payload);
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Create and return a subscriber client
   */
  createSubscriber(): Redis {
    return this.client.duplicate();
  }

  /**
   * Get keys by pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Get all keys and their values by pattern
   */
  async getAllByPattern<T = any>(pattern: string): Promise<Map<string, T>> {
    try {
      const keys = await this.keys(pattern);
      const result = new Map<string, T>();
      
      for (const key of keys) {
        const value = await this.get<T>(key);
        if (value !== null) {
          result.set(key, value);
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get all by pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Clear all keys (use with caution!)
   */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
      this.logger.warn('Redis flushed all data');
    } catch (error) {
      this.logger.error('Failed to flush Redis:', error);
      throw error;
    }
  }

  /**
   * Clear database (use with caution!)
   */
  async flushDb(): Promise<void> {
    try {
      await this.client.flushdb();
      this.logger.warn('Redis database flushed');
    } catch (error) {
      this.logger.error('Failed to flush Redis database:', error);
      throw error;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<any> {
    try {
      const info = await this.client.info();
      const infoObject: any = {};
      
      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          infoObject[key.trim()] = value.trim();
        }
      });
      
      return infoObject;
    } catch (error) {
      this.logger.error('Failed to get Redis info:', error);
      throw error;
    }
  }

  /**
   * Close the Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis disconnected successfully');
    } catch (error) {
      this.logger.error('Failed to disconnect Redis:', error);
    }
  }

  onModuleDestroy() {
    this.disconnect();
  }
}