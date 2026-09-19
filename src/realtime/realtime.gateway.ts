import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

interface JwtPayload {
  sub: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Development only
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Frontend will connect using:
      //
      // io(API_URL, {
      //   auth: {
      //     token: accessToken
      //   }
      // })

      const token = client.handshake.auth?.token;

      if (!token || typeof token !== 'string') {
        client.disconnect();
        return;
      }

      const secret = process.env.JWT_ACCESS_SECRET;

      if (!secret) {
        throw new Error('JWT_ACCESS_SECRET is not defined');
      }

      // Verify signature + expiration.
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      if (!payload.sub) {
        client.disconnect();
        return;
      }

      // Server decides the room.
      // Client cannot choose another userId.
      await client.join(`user:${payload.sub}`);

      console.log(`Socket authenticated: ${client.id}`);
    } catch {
      console.log(`Socket authentication failed: ${client.id}`);

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
  }

  videoReady(userId: string, videoId: string) {
    this.server.to(`user:${userId}`).emit('video-ready', {
      videoId,
    });
  }

  videoFailed(userId: string, videoId: string) {
    this.server.to(`user:${userId}`).emit('video-failed', {
      videoId,
    });
  }
}
