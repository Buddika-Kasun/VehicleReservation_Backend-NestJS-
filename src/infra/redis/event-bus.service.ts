// src/infra/redis/event-bus.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

export interface EventPayload {
  domain: string;
  action: string;
  data: any;
  timestamp: string;
  source?: string;
  correlationId?: string;
}

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private publisher: Redis;
  private subscriber: Redis | null = null;
  private eventHandlers: Map<string, Array<(data: any, domain: string, action: string) => Promise<void> | void>> = new Map();
  private readonly CHANNEL = 'system_events';

  constructor(private readonly redisService: RedisService) {
    this.publisher = this.redisService.getClient();
  }

  private async setupSubscriber(): Promise<void> {
    try {
      // Create a new subscriber instance
      this.subscriber = this.redisService.getDuplicateClient();
      
      // Set up message handler BEFORE subscribing
      this.subscriber.on('message', (channel: string, message: string) => {
        if (channel === this.CHANNEL) {
          this.handleIncomingMessage(message).catch(error => {
            this.logger.error(`Error in message handler: ${error.message}`);
          });
        }
      });

      // Subscribe to the channel
      await this.subscriber.subscribe(this.CHANNEL);
      
      this.logger.log(`EventBusService subscribed to channel: ${this.CHANNEL}`);
    } catch (error) {
      this.logger.error(`Failed to setup subscriber: ${error.message}`);
      throw error;
    }
  }

  private async handleIncomingMessage(message: string): Promise<void> {
    try {
      const eventPayload: EventPayload = JSON.parse(message);
      await this.handleEvent(eventPayload);
    } catch (error) {
      this.logger.error(`Error processing event: ${error.message}`, error.stack);
    }
  }

  /**
   * Publish an event
   */
  async publish(domain: string, action: string, data: any, source?: string, correlationId?: string): Promise<void> {
    const eventPayload: EventPayload = {
      domain: domain.toUpperCase(),
      action: action.toUpperCase(),
      data,
      timestamp: new Date().toISOString(),
      source: source || 'unknown',
      correlationId,
    };

    try {
      await this.redisService.publish(this.CHANNEL, eventPayload);
      this.logger.debug(`Published: ${eventPayload.domain}.${eventPayload.action}`);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subscribe to events with pattern matching
   */
  subscribe(
    pattern: string, 
    handler: (data: any, domain: string, action: string) => Promise<void> | void
  ): void {
    const normalizedPattern = pattern.toUpperCase();
    const handlers = this.eventHandlers.get(normalizedPattern) || [];
    handlers.push(handler);
    this.eventHandlers.set(normalizedPattern, handlers);
    this.logger.debug(`Subscribed to pattern: ${normalizedPattern}`);
  }

  /**
   * Subscribe to multiple patterns
   */
  subscribeMultiple(
    patterns: string[],
    handler: (data: any, domain: string, action: string) => Promise<void> | void
  ): void {
    patterns.forEach(pattern => this.subscribe(pattern, handler));
  }

  /**
   * Unsubscribe from a pattern
   */
  unsubscribe(pattern: string): void {
    const normalizedPattern = pattern.toUpperCase();
    this.eventHandlers.delete(normalizedPattern);
    this.logger.debug(`Unsubscribed from pattern: ${normalizedPattern}`);
  }

  private async handleEvent(eventPayload: EventPayload): Promise<void> {
    const { domain, action, data, correlationId } = eventPayload;
    const eventKey = `${domain}.${action}`;
    
    this.logger.debug(`Handling event: ${eventKey} ${correlationId ? `[${correlationId}]` : ''}`);

    // Get all matching handlers
    const handlersToExecute = this.getMatchingHandlers(domain, action);
    
    // Execute handlers in parallel
    const handlerPromises = handlersToExecute.map(({ pattern, handler }) => 
      this.executeHandler(handler, data, domain, action, pattern, correlationId)
    );

    await Promise.allSettled(handlerPromises);
  }

  private getMatchingHandlers(domain: string, action: string): Array<{
    pattern: string;
    handler: (data: any, domain: string, action: string) => Promise<void> | void;
  }> {
    const eventKey = `${domain}.${action}`;
    const handlersToExecute: Array<{
      pattern: string;
      handler: (data: any, domain: string, action: string) => Promise<void> | void;
    }> = [];

    // Check patterns in order of specificity
    const patternsToCheck = [
      eventKey,           // Exact match (USER.CREATE)
      `${domain}.*`,      // Domain wildcard (USER.*)
      `*.${action}`,      // Action wildcard (*.CREATE)
      '*.*',              // Catch-all
    ];

    for (const pattern of patternsToCheck) {
      if (this.eventHandlers.has(pattern)) {
        this.eventHandlers.get(pattern)!.forEach(handler => {
          handlersToExecute.push({ pattern, handler });
        });
      }
    }

    return handlersToExecute;
  }

  private async executeHandler(
    handler: (data: any, domain: string, action: string) => Promise<void> | void,
    data: any,
    domain: string,
    action: string,
    pattern: string,
    correlationId?: string
  ): Promise<void> {
    try {
      await handler(data, domain, action);
      this.logger.debug(`Handler executed for ${domain}.${action} with pattern ${pattern} ${correlationId ? `[${correlationId}]` : ''}`);
    } catch (error) {
      this.logger.error(
        `Error in handler for ${domain}.${action} (pattern: ${pattern}) ${correlationId ? `[${correlationId}]` : ''}: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Get statistics about event handlers
   */
  getStats(): { totalHandlers: number; patterns: string[] } {
    const patterns = Array.from(this.eventHandlers.keys());
    const totalHandlers = patterns.reduce((sum, pattern) => 
      sum + (this.eventHandlers.get(pattern)?.length || 0), 0
    );
    
    return { totalHandlers, patterns };
  }

  async onModuleInit() {
    try {
      await this.setupSubscriber();
      
      // Test connection using the publisher client (not subscriber)
      const pingResult = await this.publisher.ping();
      this.logger.log(`EventBusService initialized. Redis ping: ${pingResult}`);
    } catch (error) {
      this.logger.error(`Failed to initialize EventBusService: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.subscriber) {
        await this.subscriber.unsubscribe(this.CHANNEL);
        await this.subscriber.quit();
        this.subscriber = null;
      }
      this.logger.log('EventBusService cleaned up');
    } catch (error) {
      this.logger.error(`Error during EventBusService cleanup: ${error.message}`);
    }
  }
}