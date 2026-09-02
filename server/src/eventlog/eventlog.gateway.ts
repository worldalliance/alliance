import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Repository } from "typeorm";
import type { JwtPayload } from "../auth/guards/jwtreq";
import { extractTokenFromSocket } from "../messaging/gateway.utils";
import { User } from "../user/entities/user.entity";
import {
  type OnetimeInviteCreatedPayload,
  UserEvents,
} from "../user/user.events";
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.eventEmitter.on(
      EventLogEvents.Created,
      this.handleEventLogCreated.bind(this),
    );
    this.eventEmitter.on(
      UserEvents.OnetimeInviteCreated,
      this.handleOnetimeInviteCreated.bind(this),
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

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        select: ["id", "admin"],
      });

      if (!user?.admin) {
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

  private handleOnetimeInviteCreated(payload: OnetimeInviteCreatedPayload) {
    this.server.to("event-log-feed").emit("onetime-invite-created", payload);
  }
}
