import {
  MmsThreadsEvent,
  type ThreadChanged,
} from "@alliance/common/mmsThreads";
import { Logger, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { SessionService } from "src/auth/session.service";
import {
  adminSocketAuthMiddleware,
  disconnectUserSockets,
} from "src/messaging/gateway.utils";
import {
  type AccountDeletedPayload,
  type AdminRevokedPayload,
  UserEvents,
} from "src/user/user.events";
import { DetachedWorkTracker } from "src/utils/detached-work";
import { z } from "zod";
import { MmsEvents } from "./mms.events";

const socketData = z.object({ userId: z.number() });

/** Tells admins which threads changed, so they refetch. */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: "/mms-threads",
})
export class MmsThreadGateway
  implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MmsThreadGateway.name);
  private readonly detachedWork = new DetachedWorkTracker();

  private readonly onThreadChanged = (payload: ThreadChanged) =>
    this.server.emit(MmsThreadsEvent.ThreadChanged, payload);

  // When each user last lost access. A handshake that passed its admin check
  // before then may join after the disconnect scan, so it is dropped on
  // connect.
  private readonly droppedAt = new Map<number, number>();

  private readonly dropUser = ({
    userId,
  }: AccountDeletedPayload | AdminRevokedPayload) => {
    this.droppedAt.set(userId, Date.now());
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
  ) {
    this.eventEmitter.on(MmsEvents.ThreadChanged, this.onThreadChanged);
    this.eventEmitter.on(UserEvents.AccountDeleted, this.dropUser);
    this.eventEmitter.on(UserEvents.AdminRevoked, this.dropUser);
  }

  async onModuleDestroy() {
    this.eventEmitter.off(MmsEvents.ThreadChanged, this.onThreadChanged);
    this.eventEmitter.off(UserEvents.AccountDeleted, this.dropUser);
    this.eventEmitter.off(UserEvents.AdminRevoked, this.dropUser);
    await this.detachedWork.drain();
  }

  afterInit(server: Server) {
    server.use(
      adminSocketAuthMiddleware({
        jwtService: this.jwtService,
        sessionService: this.sessionService,
        logger: this.logger,
      }),
    );
  }

  handleConnection(client: Socket) {
    const { userId } = socketData.parse(client.data);
    if ((this.droppedAt.get(userId) ?? -Infinity) >= client.handshake.issued) {
      client.disconnect(true);
    }
  }
}
