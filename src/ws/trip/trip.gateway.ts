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
  namespace: 'trips',
  cors: {
    origin: '*',
  },
})
export class TripsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(TripsGateway.name);

  constructor(private readonly redisService: RedisService) {}

  afterInit(server: Server) {
    this.logger.log('Trips Gateway initialized');
    this.subscribeToRedis();
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user_${userId}`);
      this.logger.log(`Client connected to /trips: ${client.id} (User: ${userId})`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /trips: ${client.id}`);
  }

  private async subscribeToRedis() {
    const sub = this.redisService.getClient().duplicate();
    
    sub.on('message', (channel, message) => {
      try {
        const { userId, scope } = JSON.parse(message);
        this.sendRefresh(userId, scope);
      } catch (e) {
        this.logger.error(`Failed to process redis message for trips: ${e.message}`);
      }
    });

    await sub.subscribe('refresh.trips');
  }

  async sendRefresh(userId?: string, scope?: string) {
    const payload = { type: 'REFRESH', scope: scope || 'ALL' };
    if (userId) {
      this.server.to(`user_${userId}`).emit('refresh', payload);
    } else {
      this.server.emit('refresh', payload);
    }
    this.logger.debug(`Sent trip refresh signal (User: ${userId || 'All'}, Scope: ${scope})`);
  }
}
