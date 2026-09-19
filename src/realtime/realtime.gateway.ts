import {
 ConnectedSocket,
 MessageBody,
 OnGatewayConnection,
 OnGatewayDisconnect,
 SubscribeMessage,
 WebSocketGateway,
 WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

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

 handleConnection(client: Socket) {
   console.log(`Socket connected: ${client.id}`);
 }

 handleDisconnect(client: Socket) {
   console.log(`Socket disconnected: ${client.id}`);
 }

 @SubscribeMessage('join-user')
 joinUser(
   @ConnectedSocket()
   client: Socket,

   @MessageBody()
   data: { userId: string },
 ) {
   client.join(`user:${data.userId}`);
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
