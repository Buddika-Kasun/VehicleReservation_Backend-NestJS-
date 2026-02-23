// src/modules/notifications/notifications.gateway.ts (Fixed)
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { EventBusService } from 'src/infra/redis/event-bus.service';
import { JwtService } from '@nestjs/jwt';

interface WebSocketAuth {
  userId: string;
  token: string;
  deviceId?: string;
  platform?: 'android' | 'ios' | 'web';
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*', // Configure for production: ['http://localhost:3000', 'http://yourdomain.com']
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  
  // Track connected users
  private connectedUsers = new Map<string, { socketId: string; userId: string; deviceId?: string }>();

  constructor(
    private readonly eventBus: EventBusService,
    private readonly jwtService: JwtService,
  ) {}

  async afterInit() {
    // Subscribe to notification events
    this.eventBus.subscribe('NOTIFICATION.*', async (data, domain, action) => {
      await this.handleNotificationEvent(data, action);
    });
    
    this.logger.log('Notifications Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Parse authentication from handshake
      const auth = client.handshake.auth as Partial<WebSocketAuth>;
      const query = client.handshake.query;
      
      // Helper function to get string value from query param
      const getStringParam = (param: string | string[] | undefined): string | undefined => {
        if (!param) return undefined;
        if (Array.isArray(param)) return param[0];
        return param;
      };

      // Get authentication from auth or query
      const token = auth?.token || getStringParam(query.token);
      const userId = auth?.userId || getStringParam(query.userId);
      const deviceId = auth?.deviceId || getStringParam(query.deviceId);
      const platform = auth?.platform || getStringParam(query.platform) || 'unknown';

      if (!token || !userId) {
        this.logger.warn(`Connection rejected - Missing auth: ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      try {
        const decoded = await this.jwtService.verify(token);
        if (decoded.sub != userId) { 
          throw new Error('User ID mismatch');
        }
      } catch (error) {
        this.logger.warn(`Invalid token for user ${userId}: ${error.message}`);
        client.disconnect();
        return;
      }

      // Join rooms
      client.join(`user_${userId}`);
      client.join('notifications');
      
      if (deviceId) {
        client.join(`device_${deviceId}`);
      }

      // Store connection info
      this.connectedUsers.set(client.id, { 
        socketId: client.id, 
        userId, 
        deviceId 
      });

      // Send connection acknowledgement
      client.emit('connection_established', {
        success: true,
        message: 'Connected to notification server',
        timestamp: new Date().toISOString(),
        userId,
        socketId: client.id,
      });

      this.logger.log(`Client connected: ${client.id} (User: ${userId}, Platform: ${platform})`);
      this.logger.debug(`Total connections: ${this.connectedUsers.size}`);
      
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (userInfo) {
      this.logger.log(`Client disconnected: ${client.id} (User: ${userInfo.userId})`);
      this.connectedUsers.delete(client.id);
    }
    
    this.logger.debug(`Total connections: ${this.connectedUsers.size}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { 
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
    });
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      const userInfo = this.connectedUsers.get(client.id);
      if (!userInfo) {
        throw new Error('User not authenticated');
      }

      // Broadcast read status to other user sessions
      this.server.to(`user_${userInfo.userId}`).emit('notification_read', {
        notificationId: data.notificationId,
        userId: userInfo.userId,
        timestamp: new Date().toISOString(),
      });

      client.emit('mark_as_read_success', {
        success: true,
        notificationId: data.notificationId,
      });
    } catch (error) {
      client.emit('error', { 
        message: error.message,
        code: 'MARK_AS_READ_ERROR',
      });
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channels: string[] },
  ) {
    try {
      const userInfo = this.connectedUsers.get(client.id);
      if (!userInfo) {
        throw new Error('User not authenticated');
      }

      data.channels.forEach(channel => {
        client.join(channel);
      });

      client.emit('subscribe_success', {
        channels: data.channels,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      client.emit('error', {
        message: error.message,
        code: 'SUBSCRIBE_ERROR',
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channels: string[] },
  ) {
    try {
      data.channels.forEach(channel => {
        client.leave(channel);
      });

      client.emit('unsubscribe_success', {
        channels: data.channels,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      client.emit('error', {
        message: error.message,
        code: 'UNSUBSCRIBE_ERROR',
      });
    }
  }

  private async handleNotificationEvent(data: any, action: string): Promise<void> {
    try {
      const { userId, notificationId, type, broadcast = false, deviceId } = data;
      
      this.logger.log(`Notification Event: ${action}`, {
        userId: userId || 'N/A',
        type,
        broadcast: broadcast ? 'Yes' : 'No',
        timestamp: new Date().toISOString(),
      });
      
      const payload = {
        event: `NOTIFICATION_${action.toUpperCase()}`,
        action: action.toLowerCase(),
        notificationId,
        type,
        data,
        timestamp: new Date().toISOString(),
        serverTime: Date.now(),
      };

      if (userId) {
        // Send to specific user
        const userRoom = `user_${userId}`;
        
        if (action.toUpperCase() === 'REFRESH') {
          this.server.to(userRoom).emit('notification_refresh', payload);
        }
        else {
          this.server.to(userRoom).emit('notification', payload);
        }
        this.logger.debug(`Sent to ${userRoom} - Event: ${action}`);
        
        // Also send to specific device if deviceId is provided
        if (deviceId) {
          const deviceRoom = `device_${deviceId}`;
          this.server.to(deviceRoom).emit('notification', payload);
          this.logger.debug(`Sent to ${deviceRoom}`);
        }
      } else if (broadcast) {
        // Broadcast to all connected users
        this.server.to('notifications').emit('notification', payload);
        this.logger.debug(`Broadcast to all users`);
      }
      
    } catch (error) {
      this.logger.error(`Error handling notification event: ${error.message}`, error.stack);
    }
  }

  // Helper method to get connected users
  getConnectedUsers(): Array<{ socketId: string; userId: string; deviceId?: string }> {
    return Array.from(this.connectedUsers.values());
  }

  // Send notification to specific user
  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    this.server.to(`user_${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // Send notification to multiple users
  async sendToUsers(userIds: string[], event: string, data: any): Promise<void> {
    userIds.forEach(userId => {
      this.server.to(`user_${userId}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    });
  }

  // Send to specific device
  async sendToDevice(deviceId: string, event: string, data: any): Promise<void> {
    this.server.to(`device_${deviceId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}