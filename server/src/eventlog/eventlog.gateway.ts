import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { SessionService } from "../auth/session.service";
import { verifyAccessToken } from "../auth/tokens";
import { InviteFeedEvents } from "../invite-feed.events";
import {
  disconnectUserSockets,
  extractTokenFromSocket,
} from "../messaging/gateway.utils";
import { type AccountDeletedPayload, UserEvents } from "../user/user.events";
import type { EventLogDto } from "./dto/event-log.dto";
import { EventLogEvents } from "./eventlog.events";

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: "/event-log",
})
export class EventLogGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger("EventLogGateway");

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {
    this.eventEmitter.on(
      EventLogEvents.Created,
      this.handleEventLogCreated.bind(this),
    );
    this.eventEmitter.on(
      InviteFeedEvents.Created,
      this.handleInviteCreated.bind(this),
    );
    this.eventEmitter.on(
      UserEvents.AccountDeleted,
      this.handleAccountDeleted.bind(this),
    );
  }

  async handleConnection(client: Socket) {
    try {
      const token = extractTokenFromSocket(client);
      if (!token) {
        this.logger.warn("Event log gateway: missing token");
        client.disconnect(true);
        return;
      }

      const payload = await verifyAccessToken(this.jwtService, token);

      const user = await this.sessionService.currentUser(payload);

      if (!user.admin) {
        this.logger.warn(`Event log gateway: non-admin user ${payload.sub}`);
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.sub;
      this.logger.log(`Admin client connected: ${client.id}`);
    } catch {
      this.logger.warn("Event log gateway: auth failed");
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe-event-log")
  handleSubscribe(@ConnectedSocket() client: Socket) {
    client.join("event-log-feed");
    this.logger.log(`Client ${client.id} subscribed to event log feed`);
  }

  @SubscribeMessage("unsubscribe-event-log")
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    client.leave("event-log-feed");
    this.logger.log(`Client ${client.id} unsubscribed from event log feed`);
  }

  private handleEventLogCreated(eventLog: EventLogDto) {
    this.server.to("event-log-feed").emit("event-log-new", eventLog);
    this.logger.log(`Broadcast new event log: ${eventLog.event}`);
  }

  private handleInviteCreated() {
    this.server.to("event-log-feed").emit("invite-created");
  }

  private async handleAccountDeleted({ userId }: AccountDeletedPayload) {
    await disconnectUserSockets({
      server: this.server,
      userId,
      logger: this.logger,
    });
  }
}
