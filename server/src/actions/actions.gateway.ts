import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ActionsService } from "./actions.service";
import { ActionActivityDto } from "./dto/action.dto";

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: "/actions",
})
export class ActionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger("ActionsGateway");
  private clientActivitySubscriptions = new Map<string, Set<number>>();
  private clientFeedSubscriptions = new Set<string>();

  constructor(
    private readonly actionsService: ActionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.eventEmitter.on(
      "action.activity",
      this.handleActionActivity.bind(this),
    );
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientActivitySubscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clientActivitySubscriptions.delete(client.id);
    this.clientFeedSubscriptions.delete(client.id);
  }

  @SubscribeMessage("subscribe-action-activity")
  async handleSubscribeActionActivity(
    @MessageBody() data: { actionId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { actionId } = data;

    if (!actionId || typeof actionId !== "number") {
      client.emit("error", { message: "Invalid actionId" });
      return;
    }

    const clientActivitySubs =
      this.clientActivitySubscriptions.get(client.id) || new Set();
    clientActivitySubs.add(actionId);
    this.clientActivitySubscriptions.set(client.id, clientActivitySubs);

    client.join(`action-activity-${actionId}`);

    this.logger.log(
      `Client ${client.id} subscribed to activity for action ${actionId}`,
    );
  }

  @SubscribeMessage("unsubscribe-action-activity")
  handleUnsubscribeActionActivity(
    @MessageBody() data: { actionId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { actionId } = data;

    if (!actionId || typeof actionId !== "number") {
      client.emit("error", { message: "Invalid actionId" });
      return;
    }

    const clientActivitySubs = this.clientActivitySubscriptions.get(client.id);
    if (clientActivitySubs) {
      clientActivitySubs.delete(actionId);
    }

    client.leave(`action-activity-${actionId}`);
    this.logger.log(
      `Client ${client.id} unsubscribed from activity for action ${actionId}`,
    );
  }

  @SubscribeMessage("subscribe-feed")
  handleSubscribeFeed(@ConnectedSocket() client: Socket) {
    this.clientFeedSubscriptions.add(client.id);
    client.join("activity-feed");
    this.logger.log(`Client ${client.id} subscribed to activity feed`);
  }

  @SubscribeMessage("unsubscribe-feed")
  handleUnsubscribeFeed(@ConnectedSocket() client: Socket) {
    this.clientFeedSubscriptions.delete(client.id);
    client.leave("activity-feed");
    this.logger.log(`Client ${client.id} unsubscribed from activity feed`);
  }

  private async handleActionActivity(data: {
    actionId: number;
    activity: ActionActivityDto;
  }) {
    const { actionId, activity } = data;

    // Emit to clients subscribed to this specific action's activity
    this.server.to(`action-activity-${actionId}`).emit("action-activity", {
      actionId,
      activity,
    });

    // Also emit to the general feed
    this.server.to("activity-feed").emit("feed-activity", {
      actionId,
      activity,
    });

    this.logger.log(
      `Activity emitted for action ${actionId}: ${activity.type}`,
    );
  }
}
