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
import { RedisService } from '../shared/redis/redis.service';
import { NotificationType } from './types/notification-types.enum';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { WsAuthService } from '../auth/services/ws-auth.service';
import { NotificationsService } from './services/notifications.service';
import { UsersService } from '../users/users.service';
import { Notification } from '../notifications/entities/notification.entity';

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL?.split(',') || []
      : '*', 
    credentials: true,
  },
  namespace: 'notifications',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSocketMap = new Map<string, string>(); // userId -> socketId
  private socketUserMap = new Map<string, string>(); // socketId -> userId

  constructor(
    private redisService: RedisService,
    private wsAuthService: WsAuthService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Notifications Gateway initialized');
    this.initializeRedisListeners();
    
    // Handle middleware for authentication
    server.use(async (socket: Socket, next) => {
      try {
        const token = this.wsAuthService.extractTokenFromSocket(socket);
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const user = await this.wsAuthService.verifyConnection(token);
        socket.data.user = user;
        next();
      } catch (error) {
        this.logger.error(`Authentication failed: ${error.message}`);
        next(new Error('Authentication failed'));
      }
    });
  }

  private initializeRedisListeners() {
    Object.values(NotificationType).forEach((type) => {
      this.redisService.subscribe(type, (message) => {
        this.handleRedisNotification(type, message);
      });
    });
    this.logger.log('Redis listeners initialized');
  }

  async handleConnection(socket: Socket) {
    try {
      const user = socket.data.user;
      
      if (!user) {
        this.logger.warn(`Client ${socket.id} connected without authentication`);
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }

      // Store connection mappings
      this.userSocketMap.set(user.userId.toString(), socket.id);
      this.socketUserMap.set(socket.id, user.userId.toString());

      // Join user-specific room
      socket.join(`user-${user.userId}`);

      // Join role-based rooms
      const roles = this.wsAuthService.getUserRoles(user.role);
      roles.forEach(role => socket.join(role));

      this.logger.log(`User ${user.username} (${user.userId}) connected`);

      // Send connection confirmation
      socket.emit('connected', {
        socketId: socket.id,
        userId: user.userId,
        username: user.username,
        role: user.role,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Connection error for socket ${socket.id}:`, error);
      socket.emit('error', { message: 'Connection failed' });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = this.socketUserMap.get(socket.id);
    if (userId) {
      this.userSocketMap.delete(userId);
      this.socketUserMap.delete(socket.id);
      this.logger.log(`User ${userId} disconnected`);
    }
  }

  private async handleRedisNotification(type: NotificationType, message: any) {
    try {
      const { notification } = message;
      
      // Determine who should receive this notification
      const recipients = await this.getRecipientsForNotification(type, notification);
      
      // Send to each recipient
      recipients.forEach((recipient) => {
        const socketId = this.userSocketMap.get(recipient);
        if (socketId) {
          this.server.to(socketId).emit('notification', {
            type,
            data: notification,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Also emit to specific rooms based on type
      switch (type) {
        case NotificationType.USER_REGISTERED:
          this.server.to('role-admin').emit('user-registered', {
            data: notification,
            timestamp: new Date().toISOString(),
          });
          break;
          
        case NotificationType.USER_APPROVED:
          if (notification.data?.userId) {
            this.server.to(`user-${notification.data.userId}`).emit('user-approved', {
              data: notification,
              timestamp: new Date().toISOString(),
            });
          }
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling notification ${type}:`, error);
    }
  }

  private async getRecipientsForNotification(
    type: NotificationType,
    notification: any,
  ): Promise<string[]> {
    const recipients: string[] = [];

    try {
      switch (type) {
        case NotificationType.USER_REGISTERED:
          const approvers = await this.getApprovers();
          approvers.forEach(approver => recipients.push(approver.id.toString()));
          break;

        case NotificationType.USER_APPROVED:
          if (notification.data?.userId) {
            recipients.push(notification.data.userId.toString());
          }
          break;

        default:
          if (notification.userId) {
            recipients.push(notification.userId.toString());
          }
      }
    } catch (error) {
      this.logger.error(`Error getting recipients for ${type}:`, error);
    }

    return [...new Set(recipients)];
  }

  private async getApprovers(): Promise<{ id: string; username: string }[]> {
    try {
      const approvers = await this.usersService.getApprovers();
      return approvers.map(approver => ({
        id: approver.id.toString(),
        username: approver.username || approver.displayname,
      }));
    } catch (error) {
      this.logger.error(`Error getting approvers:`, error);
      return [];
    }
  }

  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      await this.notificationsService.markAsRead(data.notificationId, userId);
      this.logger.log(`User ${userId} marked notification ${data.notificationId} as read`);
      
      return { 
        success: true, 
        message: 'Notification marked as read',
        notificationId: data.notificationId 
      };
    } catch (error) {
      this.logger.error(`Error marking notification as read:`, error);
      return { success: false, error: 'Failed to mark as read' };
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket) {
    const userId = this.socketUserMap.get(socket.id);
    socket.emit('pong', { 
      userId,
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }

  @SubscribeMessage('get-initial-notifications')
  async handleGetInitialNotifications(@ConnectedSocket() socket: Socket) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const [notifications] = await this.notificationsService.getNotifications(
        userId,
        0,  // skip
        50, // limit
        undefined, // type
        false, // unreadOnly
      );

      const unreadCount = await this.notificationsService.getUnreadCount(userId);
      
      // Format notifications for frontend
      const formattedNotifications = notifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: this.getNotificationTitle(notification),
        message: this.getNotificationMessage(notification),
        data: notification.data,
        read: notification.read,
        createdAt: notification.createdAt,
        isPending: notification.type === NotificationType.USER_REGISTERED,
        metadata: notification.metadata,
      }));

      socket.emit('initial-notifications', {
        notifications: formattedNotifications,
        unreadCount: unreadCount,
      });

      this.logger.log(`Sent ${formattedNotifications.length} notifications to user ${userId}`);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error getting initial notifications:`, error);
      socket.emit('error', { message: 'Failed to load notifications' });
      return { success: false, error: 'Failed to load notifications' };
    }
  }

private getNotificationTitle(notification: Notification): string {
  switch (notification.type) {
    case NotificationType.USER_REGISTERED:
      return 'New User Registration';
    case NotificationType.USER_APPROVED:
      return 'Account Approved';
    case NotificationType.TRIP_CREATED:
      return 'New Trip Created';
    case NotificationType.TRIP_UPDATED:
      return 'Trip Updated';
    case NotificationType.SYSTEM_ALERT:
      return 'System Alert';
    default:
      return 'Notification';
  }
}

private getNotificationMessage(notification: Notification): string {
  switch (notification.type) {
    case NotificationType.USER_REGISTERED:
      const username = notification.metadata?.username || 'a new user';
      return `${username} has registered for an account`;
    case NotificationType.USER_APPROVED:
      return 'Your account has been approved by an administrator';
    case NotificationType.TRIP_CREATED:
      return 'A new trip has been created';
    case NotificationType.TRIP_UPDATED:
      return 'A trip has been updated';
    case NotificationType.SYSTEM_ALERT:
      return notification.data?.message || 'System notification';
    default:
      return notification.data?.message || 'You have a new notification';
  }
}

  @SubscribeMessage('get-unread-count')
  async handleGetUnreadCount(@ConnectedSocket() socket: Socket) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const count = await this.notificationsService.getUnreadCount(userId);
      socket.emit('unread-count', { count: count });
      this.logger.log(`Sent unread count ${count} to user ${userId}`);
      return { success: true, count };
    } catch (error) {
      this.logger.error(`Error getting unread count:`, error);
      return { success: false, error: 'Failed to get unread count' };
    }
  }

  @SubscribeMessage('mark-all-read')
  async handleMarkAllAsRead(@ConnectedSocket() socket: Socket) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      await this.notificationsService.markAllAsRead(userId);
      socket.emit('all-read-response', { success: true });
      this.logger.log(`User ${userId} marked all as read`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking all as read:`, error);
      return { success: false, error: 'Failed to mark all as read' };
    }
  }

  @SubscribeMessage('delete-notification')
  async handleDeleteNotification(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      // Check if the notification exists and is unread
      const notification = await this.notificationsService.findById(data.notificationId);
      const wasUnread = notification && !notification.read && notification.userId === userId;

      await this.notificationsService.deleteNotification(data.notificationId, userId);
      this.logger.log(`User ${userId} deleted notification ${data.notificationId}`);
      
      return { 
        success: true, 
        message: 'Notification deleted',
        notificationId: data.notificationId,
        wasUnread,
      };
    } catch (error) {
      this.logger.error(`Error deleting notification:`, error);
      return { success: false, error: 'Failed to delete notification' };
    }
  }

  @SubscribeMessage('clear-all-notifications')
  async handleClearAllNotifications(@ConnectedSocket() socket: Socket) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const result = await this.notificationsService.deleteAllUserNotifications(userId);
      socket.emit('clear-all-notifications-response', { 
        success: true,
        clearedCount: result.deleted,
      });
      this.logger.log(`User ${userId} cleared all notifications (${result.deleted} cleared)`);
      return { success: true, clearedCount: result.deleted };
    } catch (error) {
      this.logger.error(`Error clearing all notifications:`, error);
      return { success: false, error: 'Failed to clear all notifications' };
    }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      socket.join(data.room);
      this.logger.log(`User ${userId} joined room: ${data.room}`);
      return { success: true, room: data.room };
    } catch (error) {
      this.logger.error(`Error joining room:`, error);
      return { success: false, error: 'Failed to join room' };
    }
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = this.socketUserMap.get(socket.id);
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    try {
      socket.leave(data.room);
      this.logger.log(`User ${userId} left room: ${data.room}`);
      return { success: true, room: data.room };
    } catch (error) {
      this.logger.error(`Error leaving room:`, error);
      return { success: false, error: 'Failed to leave room' };
    }
  }

}