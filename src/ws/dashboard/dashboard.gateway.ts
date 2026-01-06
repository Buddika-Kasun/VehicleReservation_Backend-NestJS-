import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisService } from 'src/infra/redis/redis.service';
import { WsAuthService } from 'src/modules/auth/services/ws-auth.service';

@WebSocketGateway({
  namespace: 'dashboard',
  cors: {
    origin: '*',
  },
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(DashboardGateway.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly wsAuthService: WsAuthService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Dashboard Gateway initialized');
    this.subscribeToRedis();
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.wsAuthService.extractTokenFromSocket(client);
      const user = await this.wsAuthService.verifyConnection(token);
      
      client.data.user = user;
      
      // Join general dashboard room
      client.join('dashboard_all');
      
      // Join role-specific rooms
      const roles = this.wsAuthService.getUserRoles(user.role);
      roles.forEach(role => client.join(`dashboard_role_${role}`));
      
      // Join user-specific room
      client.join(`dashboard_user_${user.userId}`);

      this.logger.log(`Client connected to /dashboard: ${client.id} (User: ${user.username}, Role: ${user.role})`);
    } catch (error) {
      this.logger.warn(`Auth failed for /dashboard connection: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /dashboard: ${client.id}`);
  }

  private async subscribeToRedis() {
    const sub = this.redisService.getClient().duplicate();
    
    sub.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message);
        this.broadcastRefresh(payload);
      } catch (e) {
        this.logger.error(`Failed to process redis message for dashboard: ${e.message}`);
      }
    });

    await sub.subscribe('refresh.dashboard');
  }

  /**
   * Broadcast refresh signal to relevant rooms based on payload
   */
  private broadcastRefresh(payload: any) {
    const { userId, role, scope } = payload;
    const emitPayload = { type: 'REFRESH', scope: scope || 'ALL' };

    if (userId) {
      this.server.to(`dashboard_user_${userId}`).emit('refresh', emitPayload);
    } else if (role) {
      this.server.to(`dashboard_role_${role}`).emit('refresh', emitPayload);
    } else {
      this.server.emit('refresh', emitPayload);
    }

    this.logger.debug(`Sent dashboard refresh signal (User: ${userId || 'All'}, Role: ${role || 'All'}, Scope: ${scope})`);
  }
}
