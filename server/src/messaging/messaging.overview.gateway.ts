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
import { SessionService } from "src/auth/session.service";
import { type AccountDeletedPayload, UserEvents } from "src/user/user.events";
import { DetachedWorkTracker } from "src/utils/detached-work";
import type { Repository } from "typeorm";
import { ConversationService } from "./conversation.service";
import { MessageDto } from "./dto/messaging.dto";
import { Participant } from "./entities/participant.entity";
import { disconnectUserSockets, socketAuthMiddleware } from "./gateway.utils";
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

  private readonly onAccountDeleted = ({ userId }: AccountDeletedPayload) => {
    this.detachedWork.track(
      disconnectUserSockets({
        server: this.server,
        userId,
        logger: this.logger,
      }),
    );
  };

  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly conversationService: ConversationService,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
  ) {
    this.eventEmitter.on(MessagingEvents.MessageCreated, this.onMessageCreated);
    this.eventEmitter.on(UserEvents.AccountDeleted, this.onAccountDeleted);
    this.eventEmitter.on(
      MessagingEvents.ConversationUpdated,
      this.onConversationUpdated,
    );
  }

  async onModuleDestroy() {
    this.eventEmitter.off(UserEvents.AccountDeleted, this.onAccountDeleted);
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
    server.use(
      socketAuthMiddleware({
        jwtService: this.jwtService,
        sessionService: this.sessionService,
        logger: this.logger,
      }),
    );
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
