import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelsService } from './channels.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Messagerie en temps reel (section 13, Socket.io).
 * Presence des utilisateurs connectes pour le tableau de bord Super Admin.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: '/ws' })
export class ChannelsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('ChannelsGateway');

  /** userId -> nombre de sockets ouverts */
  private online = new Map<string, number>();

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private channels: ChannelsService,
  ) {}

  private async authenticate(client: Socket): Promise<AuthUser | null> {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');
    if (!token) return null;

    try {
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          countryId: true,
          provinceId: true,
          orphanageId: true,
          staffFunction: true,
        },
      });
      if (!user || user.status !== 'ACTIVE') return null;
      return user as AuthUser;
    } catch {
      return null;
    }
  }

  async handleConnection(client: Socket) {
    const user = await this.authenticate(client);
    if (!user) {
      client.emit('error', { message: 'Authentification requise' });
      client.disconnect();
      return;
    }

    client.data.user = user;
    this.online.set(user.id, (this.online.get(user.id) ?? 0) + 1);

    const memberships = await this.prisma.channelMember.findMany({
      where: { userId: user.id },
      select: { channelId: true },
    });
    for (const m of memberships) client.join(`channel:${m.channelId}`);
    client.join(`user:${user.id}`);

    this.server.emit('presence:update', { online: this.online.size });
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user as AuthUser | undefined;
    if (!user) return;
    const count = (this.online.get(user.id) ?? 1) - 1;
    if (count <= 0) this.online.delete(user.id);
    else this.online.set(user.id, count);
    this.server.emit('presence:update', { online: this.online.size });
  }

  onlineCount(): number {
    return this.online.size;
  }

  onlineUserIds(): string[] {
    return [...this.online.keys()];
  }

  @SubscribeMessage('channel:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() body: { channelId: string }) {
    const user = client.data.user as AuthUser;
    await this.channels.assertMember(body.channelId, user);
    client.join(`channel:${body.channelId}`);
    return { joined: body.channelId };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId: string; content: string; attachments?: string[] },
  ) {
    const user = client.data.user as AuthUser;
    const message = await this.channels.send(
      body.channelId,
      { content: body.content, attachments: body.attachments },
      user,
    );
    this.server.to(`channel:${body.channelId}`).emit('message:new', message);
    return message;
  }

  @SubscribeMessage('message:read')
  async read(@ConnectedSocket() client: Socket, @MessageBody() body: { channelId: string }) {
    const user = client.data.user as AuthUser;
    await this.channels.markRead(body.channelId, user);
    this.server.to(`channel:${body.channelId}`).emit('message:read', {
      channelId: body.channelId,
      userId: user.id,
      at: new Date().toISOString(),
    });
    return { success: true };
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: Socket, @MessageBody() body: { channelId: string }) {
    const user = client.data.user as AuthUser;
    client.to(`channel:${body.channelId}`).emit('typing', {
      channelId: body.channelId,
      userId: user.id,
    });
  }

  /** Notification poussee vers un utilisateur precis. */
  pushToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
