import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export interface PubSubEvent {
  type: string;
  data: any;
  metadata?: {
    timestamp: string;
    source?: string;
    correlationId?: string;
    retryCount?: number;
  };
}

export interface Subscription {
  unsubscribe: () => void;
}

@Injectable()
export class PubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(PubSubService.name);
  private subscriptions = new Map<string, Set<(event: PubSubEvent) => void>>();
  private redisSubscriptions = new Map<string, (message: any) => void>();
  
  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.setupErrorHandling();
  }

  /**
   * Publish an event to a channel
   */
  async publish(channel: string, data: any, metadata?: Partial<PubSubEvent['metadata']>): Promise<void> {
    const event: PubSubEvent = {
      type: channel,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'nestjs-app',
        ...metadata,
      },
    };

    try {
      // Publish to Redis for cross-instance communication
      await this.redisService.publish(channel, event);
      
      // Also emit locally for in-memory subscribers
      this.emitLocal(channel, event);
      
      this.logger.debug(`Published event to ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to publish event to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(
    channel: string,
    callback: (event: PubSubEvent) => void,
    options?: {
      pattern?: boolean; // Subscribe to pattern matching
      once?: boolean; // Listen only once
    },
  ): Promise<Subscription> {
    try {
      // Local subscription (in-memory)
      const localUnsubscribe = this.subscribeLocal(channel, callback, options?.once);
      
      // Redis subscription (cross-instance)
      const redisUnsubscribe = await this.subscribeRedis(channel, callback, options?.pattern);
      
      this.logger.debug(`Subscribed to ${channel}`);
      
      return {
        unsubscribe: () => {
          localUnsubscribe();
          redisUnsubscribe();
          this.logger.debug(`Unsubscribed from ${channel}`);
        },
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to multiple channels
   */
  async subscribeMultiple(
    channels: string[],
    callback: (event: PubSubEvent) => void,
  ): Promise<Subscription[]> {
    const subscriptionPromises = channels.map(channel => 
      this.subscribe(channel, callback)
    );
    return Promise.all(subscriptionPromises);
  }

  /**
   * Subscribe to a pattern (e.g., "user.*")
   */
  async subscribePattern(
    pattern: string,
    callback: (event: PubSubEvent) => void,
  ): Promise<Subscription> {
    return this.subscribe(pattern, callback, { pattern: true });
  }

  /**
   * Wait for a specific event (useful for testing)
   */
    async waitFor(
    channel: string,
    timeout = 5000,
    condition?: (event: PubSubEvent) => boolean,
    ): Promise<PubSubEvent> {
    return new Promise((resolve, reject) => {
        let sub: Subscription | null = null;

        const timeoutId = setTimeout(() => {
        if (sub) {
            sub.unsubscribe();
        }
        reject(new Error(`Timeout waiting for event: ${channel}`));
        }, timeout);

        this.subscribe(channel, (event) => {
        if (!condition || condition(event)) {
            clearTimeout(timeoutId);
            if (sub) {
            sub.unsubscribe();
            }
            resolve(event);
        }
        })
        .then((s) => {
            sub = s; // assign subscription safely
        })
        .catch(reject);
    });
    }

  /**
   * Emit an event locally (in-memory only)
   */
  private emitLocal(channel: string, event: PubSubEvent): void {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          this.logger.error(`Error in local callback for ${channel}:`, error);
        }
      });
    }
  }

  /**
   * Subscribe locally (in-memory)
   */
  private subscribeLocal(
    channel: string,
    callback: (event: PubSubEvent) => void,
    once = false,
  ): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }

    const callbacks = this.subscriptions.get(channel)!;
    
    let wrappedCallback: (event: PubSubEvent) => void;
    
    if (once) {
      wrappedCallback = (event: PubSubEvent) => {
        callback(event);
        this.unsubscribeLocal(channel, wrappedCallback);
      };
    } else {
      wrappedCallback = callback;
    }

    callbacks.add(wrappedCallback);

    return () => this.unsubscribeLocal(channel, wrappedCallback);
  }

  /**
   * Unsubscribe locally
   */
  private unsubscribeLocal(channel: string, callback: (event: PubSubEvent) => void): void {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  /**
   * Subscribe via Redis
   */
  private async subscribeRedis(
    channel: string,
    callback: (event: PubSubEvent) => void,
    pattern = false,
  ): Promise<() => void> {
    const redisCallback = (message: any) => {
      try {
        let event: PubSubEvent;
        
        // Handle pattern subscription response (has message and channel)
        if (message && typeof message === 'object' && 'message' in message && 'channel' in message) {
          event = typeof message.message === 'string' 
            ? JSON.parse(message.message) 
            : message.message;
        } 
        // Handle regular subscription (just the message)
        else {
          event = typeof message === 'string' ? JSON.parse(message) : message;
        }
        
        callback(event);
      } catch (error) {
        this.logger.error(`Error parsing Redis message for ${channel}:`, error);
      }
    };

    // Store the callback for later unsubscription
    const callbackKey = pattern ? `pattern:${channel}` : `channel:${channel}`;
    this.redisSubscriptions.set(callbackKey, redisCallback);

    if (pattern) {
      await this.redisService.subscribePattern(channel, redisCallback);
      return () => {
        this.redisService.unsubscribePattern(channel).catch(error => {
          this.logger.error(`Failed to unsubscribe from pattern ${channel}:`, error);
        });
        this.redisSubscriptions.delete(callbackKey);
      };
    } else {
      await this.redisService.subscribe(channel, redisCallback);
      return () => {
        this.redisService.unsubscribe(channel).catch(error => {
          this.logger.error(`Failed to unsubscribe from channel ${channel}:`, error);
        });
        this.redisSubscriptions.delete(callbackKey);
      };
    }
  }

  /**
   * Get active subscription count
   */
  getSubscriptionCount(channel?: string): number {
    if (channel) {
      return this.subscriptions.get(channel)?.size || 0;
    }
    
    let total = 0;
    this.subscriptions.forEach(callbacks => {
      total += callbacks.size;
    });
    return total;
  }

  /**
   * Get all active channels
   */
  getActiveChannels(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Clear all subscriptions
   */
  clearAll(): void {
    // Clear local subscriptions
    this.subscriptions.clear();
    
    // Unsubscribe from Redis
    this.redisSubscriptions.forEach((_, key) => {
      const [type, channel] = key.split(':');
      try {
        if (type === 'pattern') {
          this.redisService.unsubscribePattern(channel).catch(() => {
            // Silently fail during cleanup
          });
        } else {
          this.redisService.unsubscribe(channel).catch(() => {
            // Silently fail during cleanup
          });
        }
      } catch (error) {
        // Silently fail during cleanup
      }
    });
    this.redisSubscriptions.clear();
    
    this.logger.log('Cleared all subscriptions');
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
    });
  }

  async onModuleDestroy() {
    this.clearAll();
    this.logger.log('PubSubService destroyed');
  }

  /**
   * Get Redis connection status
   */
  async getConnectionStatus(): Promise<{
    isConnected: boolean;
    activeChannels: number;
    totalSubscriptions: number;
  }> {
    try {
      await this.redisService.ping();
      return {
        isConnected: true,
        activeChannels: this.getActiveChannels().length,
        totalSubscriptions: this.getSubscriptionCount(),
      };
    } catch (error) {
      return {
        isConnected: false,
        activeChannels: 0,
        totalSubscriptions: 0,
      };
    }
  }
}