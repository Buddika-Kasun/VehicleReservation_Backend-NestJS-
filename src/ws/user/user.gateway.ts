// users.gateway.ts - Handles USER.* events
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { EventBusService } from 'src/infra/redis/event-bus.service';

@WebSocketGateway({
  namespace: 'users',
  cors: { origin: '*' },
})
export class UsersGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(UsersGateway.name);

  constructor(private readonly eventBus: EventBusService) {}

  async afterInit() {
    this.eventBus.subscribe('USER.*', async (data, domain, action) => {
      await this.handleUserEvent(data, action);
    });
    
    this.logger.log('Users Gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user_${userId}`);
      client.join(`users`);
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private async handleUserEvent(data: any, action: string): Promise<void> {
    try {
      const { userId, ...restData } = data;
      
      const payload = {
        action: action.toLowerCase(),
        data: restData,
        timestamp: new Date().toISOString()
      };

      if (userId) {
        this.server.to(`user_${userId}`).emit('user_update', payload);
        this.logger.debug(`Sent user ${action} to user_${userId}`);
      }
      
      this.server.to(`users`).emit('user_update', payload);
    } catch (error) {
      this.logger.error(`Error handling user event: ${error.message}`);
    }
  }
}