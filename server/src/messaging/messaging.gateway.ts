import { Logger, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import type { JwtPayload } from "src/auth/guards/jwtreq";
import { DetachedWorkTracker } from "src/utils/detached-work";
import { ConversationService } from "./conversation.service";
import { MessageDto } from "./dto/messaging.dto";
import { extractTokenFromSocket } from "./gateway.utils";
import { MessagingEvents } from "./messaging.events";

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: "/messaging",
})
export class MessagingGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private readonly clientRooms = new Map<string, Set<number>>();
  private readonly clientUserIds = new Map<string, number>();
  private readonly detachedWork = new DetachedWorkTracker();

  private readonly onMessageCreated = this.handleMessageCreated.bind(this);
  private readonly onConversationUpdated = (payload: {
    conversationId: number;
  }) => {
    this.detachedWork.track(
      this.handleConversationUpdated(payload).catch((error: Error) =>
        this.logger.warn(
          `Failed to broadcast update for conversation ${payload.conversationId}: ${error.message}`,
        ),
      ),
    );
  };

  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly conversationService: ConversationService,
  ) {
    this.eventEmitter.on(MessagingEvents.MessageCreated, this.onMessageCreated);
    this.eventEmitter.on(
      MessagingEvents.ConversationUpdated,
      this.onConversationUpdated,
    );
  }

  async onModuleDestroy() {
    this.eventEmitter.off(
      MessagingEvents.MessageCreated,
      this.onMessageCreated,
    );
    this.eventEmitter.off(
      MessagingEvents.ConversationUpdated,
      this.onConversationUpdated,
    );
    await this.detachedWork.drain();
  }

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const token = extractTokenFromSocket(socket);
        if (!token) {
          return next(new Error("Unauthorized"));
        }
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
          secret: process.env.JWT_SECRET,
        });
        socket.data.userId = payload.sub;
        next();
      } catch (error) {
        this.logger.warn(
          `Messaging gateway auth failed: ${(error as Error).message}`,
        );
        next(new Error((error as Error).message));
      }
    });
  }

  handleConnection(client: Socket) {
    const userId = client.data.userId as number;
    this.clientRooms.set(client.id, new Set());
    this.clientUserIds.set(client.id, userId);
  }

  handleDisconnect(client: Socket) {
    this.clientRooms.delete(client.id);
    this.clientUserIds.delete(client.id);
  }

  @SubscribeMessage("join-conversation")
  async handleJoinConversation(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const conversationId = Number(data?.conversationId);
    if (!conversationId || Number.isNaN(conversationId)) {
      client.emit("messaging:error", { message: "Invalid conversation id." });
      return;
    }

    const userId = client.data.userId as number | undefined;
    if (!userId) {
      client.emit("messaging:error", { message: "Unauthorized." });
      client.disconnect(true);
      return;
    }

    const allowed = await this.conversationService.isParticipant(
      conversationId,
      userId,
    );
    if (!allowed) {
      client.emit("messaging:error", { message: "Access denied." });
      return;
    }

    client.join(this.roomName(conversationId));
    this.trackClientRoom(client.id, conversationId);
    client.emit("conversation-joined", { conversationId });
  }

  @SubscribeMessage("leave-conversation")
  handleLeaveConversation(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const conversationId = Number(data?.conversationId);
    if (!conversationId || Number.isNaN(conversationId)) {
      client.emit("messaging:error", { message: "Invalid conversation id." });
      return;
    }

    client.leave(this.roomName(conversationId));
    this.untrackClientRoom(client.id, conversationId);
    client.emit("conversation-left", { conversationId });
  }

  private handleMessageCreated(payload: {
    conversationId: number;
    message: MessageDto;
  }) {
    this.server
      .to(this.roomName(payload.conversationId))
      .emit("message:new", payload.message);
  }

  private async handleConversationUpdated(payload: { conversationId: number }) {
    const room = this.roomName(payload.conversationId);
    const sockets = await this.server.in(room).fetchSockets();
    for (const socket of sockets) {
      const userId = socket.data.userId as number | undefined;
      if (!userId) {
        continue;
      }
      try {
        const conversation =
          await this.conversationService.getConversationForUser(
            payload.conversationId,
            userId,
          );
        socket.emit("conversation:updated", conversation);
      } catch (error) {
        this.logger.warn(
          `Failed to build conversation dto for socket ${socket.id}: ${error.message}`,
        );
      }
    }
  }

  private trackClientRoom(clientId: string, conversationId: number) {
    const rooms = this.clientRooms.get(clientId) ?? new Set<number>();
    rooms.add(conversationId);
    this.clientRooms.set(clientId, rooms);
  }

  private untrackClientRoom(clientId: string, conversationId: number) {
    const rooms = this.clientRooms.get(clientId);
    if (!rooms) {
      return;
    }

    rooms.delete(conversationId);
    if (!rooms.size) {
      this.clientRooms.delete(clientId);
    } else {
      this.clientRooms.set(clientId, rooms);
    }
  }

  async getUsersViewingConversation(
    conversationId: number,
  ): Promise<Set<number>> {
    const room = this.roomName(conversationId);
    const sockets = await this.server.in(room).fetchSockets();
    if (!sockets) return new Set();

    const userIds = new Set<number>();
    for (const socket of sockets) {
      const userId = this.clientUserIds.get(socket.id);
      if (userId) userIds.add(userId);
    }
    return userIds;
  }

  private roomName(conversationId: number) {
    return `conversation:${conversationId}`;
  }
}
