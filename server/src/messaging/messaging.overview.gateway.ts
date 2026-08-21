import { Logger, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import type { JwtPayload } from "src/auth/guards/jwtreq";
import { DetachedWorkTracker } from "src/utils/detached-work";
import type { Repository } from "typeorm";
import { ConversationService } from "./conversation.service";
import { MessageDto } from "./dto/messaging.dto";
import { Participant } from "./entities/participant.entity";
import { extractTokenFromSocket } from "./gateway.utils";
import { MessagingEvents } from "./messaging.events";

interface MessageCreatedPayload {
  conversationId: number;
  message: MessageDto;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: "/messaging/overview",
})
export class MessagingOverviewGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingOverviewGateway.name);
  private readonly socketUsers = new Map<string, number>();
  private readonly detachedWork = new DetachedWorkTracker();

  private readonly onMessageCreated = (payload: MessageCreatedPayload) => {
    this.detachedWork.track(
      this.handleMessageCreated(payload).catch((error: Error) =>
        this.logger.warn(
          `Failed to emit unread updates for conversation ${payload.conversationId}: ${error.message}`,
        ),
      ),
    );
  };

  private readonly onConversationUpdated = (payload: {
    conversationId: number;
  }) => {
    this.detachedWork.track(
      this.handleConversationUpdated(payload).catch((error: Error) =>
        this.logger.warn(
          `Failed to emit updates for conversation ${payload.conversationId}: ${error.message}`,
        ),
      ),
    );
  };

  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly conversationService: ConversationService,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
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
          `Messaging overview gateway auth failed: ${(error as Error).message ?? error}`,
        );
        next(new Error((error as Error).message));
      }
    });
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as number;
    this.socketUsers.set(client.id, userId);
    client.join(this.userRoom(userId));
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.socketUsers.delete(client.id);
  }

  private async handleMessageCreated(payload: MessageCreatedPayload) {
    const participants = await this.participantRepository.find({
      where: { conversation: { id: payload.conversationId } },
      relations: { user: true },
    });

    await Promise.all(
      participants.map(async (participant) => {
        const userId = participant.user?.id;
        if (!userId) {
          return;
        }

        try {
          const conversation =
            await this.conversationService.getConversationForUser(
              payload.conversationId,
              userId,
            );

          this.server.to(this.userRoom(userId)).emit("conversation:unread", {
            conversationId: payload.conversationId,
            unreadCount: conversation.unreadCount,
            lastMessage: payload.message,
            conversation,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to emit unread update to user ${userId} for conversation ${payload.conversationId}: ${
              (error as Error).message ?? error
            }`,
          );
        }
      }),
    );
  }

  private async handleConversationUpdated(payload: { conversationId: number }) {
    const participants = await this.participantRepository.find({
      where: { conversation: { id: payload.conversationId } },
      relations: { user: true },
    });

    await Promise.all(
      participants.map(async (participant) => {
        const userId = participant.user?.id;
        if (!userId) return;
        try {
          const conversation =
            await this.conversationService.getConversationForUser(
              payload.conversationId,
              userId,
            );

          this.server.to(this.userRoom(userId)).emit("conversation:unread", {
            conversationId: payload.conversationId,
            unreadCount: conversation.unreadCount,
            conversation,
            lastMessage: conversation.lastMessage,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to emit conversation update to user ${userId} for conversation ${payload.conversationId}: ${
              (error as Error).message ?? error
            }`,
          );
        }
      }),
    );
  }

  private userRoom(userId: number): string {
    return `user:${userId}`;
  }
}
