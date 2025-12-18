import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from 'src/infra/redis/redis.service';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  private onlineUsers: Map<string, Set<string>> = new Map();
  constructor(private readonly redisService: RedisService) {}

  afterInit(server: Server) {
    this.logger.log('Notifications Gateway initialized');
    this.subscribeToRedis();
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user_${userId}`);
      this.logger.log(`Client connected to /notifications: ${client.id} (User: ${userId})`);
    } else {
      this.logger.log(`Client connected to /notifications: ${client.id} (Guest)`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /notifications: ${client.id}`);
  }

  private async subscribeToRedis() {
    const sub = this.redisService.getClient().duplicate();
    
    sub.on('message', (channel, message) => {
      try {
        const { userId, scope } = JSON.parse(message);
        this.sendRefresh(userId, scope);
      } catch (e) {
        this.logger.error(`Failed to process redis message for notifications: ${e.message}`);
      }
    });

    await sub.subscribe('refresh.notifications');
  }

  /**
   * Send a 'refresh' signal to a specific user or all users.
   * The frontend should listen for this event and refetch notifications/counts.
   * @param userId Target user ID (optional)
   * @param scope The scope of refresh (e.g., 'READ_STATUS', 'ALL')
   */
  async sendRefresh(userId?: string, scope?: string) {
    const payload = { type: 'REFRESH', scope: scope || 'ALL' };
    if (userId) {
      this.server.to(`user_${userId}`).emit('refresh', payload);
      this.logger.debug(`Sent refresh signal to user_${userId} (Scope: ${scope || 'ALL'})`);
    } else {
      this.server.emit('refresh', payload);
      this.logger.debug(`Sent refresh signal to all users (Scope: ${scope || 'ALL'})`);
    }
  }
}
