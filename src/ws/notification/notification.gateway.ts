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
import { EVENTS } from 'src/common/constants/events.constants';

@WebSocketGateway({
  namespace: 'notifications',
  cors: { origin: '*' },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly eventBus: EventBusService) {}

  async afterInit() {
    this.eventBus.subscribe('NOTIFICATION.*', async (data, domain, action) => {
      await this.handleNotificationEvent(data, action);
    });
    
    this.logger.log('Notifications Gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user_${userId}`);
      client.join(`notifications`);
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private async handleNotificationEvent(data: any, action: string): Promise<void> {
  try {
    const { userId, notificationId, type, broadcast = false } = data;
    
    this.logger.log(`Notification Event`, {
      action,
      userId: userId || 'N/A',
      type,
      broadcast: broadcast ? 'Yes' : 'No'
    });
    
    const payload = {
      action: action.toLowerCase(),
      notificationId,
      type,
      data,
      timestamp: new Date().toISOString()
    };

    if (userId) {
      // Always send to specific user
      this.server.to(`user_${userId}`).emit('notification_update', payload);
      this.logger.debug(`Sent to user_${userId}`);
    } else {
      // No userId specified - broadcast to all
      this.server.to(`notifications`).emit('notification_update', payload);
      this.logger.debug(`Broadcast to all users (no specific userId)`);
    }
    
  } catch (error) {
    this.logger.error(`Error handling notification event: ${error.message}`);
  }
}
}