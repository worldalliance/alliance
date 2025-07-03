import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ActionsService } from './actions.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ActionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ActionsGateway');
  private clientSubscriptions = new Map<string, Set<number>>();

  constructor(
    private readonly actionsService: ActionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.eventEmitter.on('action.delta', this.handleActionDelta.bind(this));
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clientSubscriptions.delete(client.id);
  }

  @SubscribeMessage('subscribe-action')
  async handleSubscribeAction(
    @MessageBody() data: { actionId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { actionId } = data;

    if (!actionId || typeof actionId !== 'number') {
      client.emit('error', { message: 'Invalid actionId' });
      return;
    }

    const clientSubs = this.clientSubscriptions.get(client.id) || new Set();
    clientSubs.add(actionId);
    this.clientSubscriptions.set(client.id, clientSubs);

    client.join(`action-${actionId}`);

    // Send initial count
    const initialCount = await this.actionsService
      .countCommitted(actionId)
      .toPromise();
    client.emit('action-count', { actionId, count: initialCount });

    this.logger.log(`Client ${client.id} subscribed to action ${actionId}`);
  }

  @SubscribeMessage('unsubscribe-action')
  handleUnsubscribeAction(
    @MessageBody() data: { actionId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { actionId } = data;

    if (!actionId || typeof actionId !== 'number') {
      client.emit('error', { message: 'Invalid actionId' });
      return;
    }

    const clientSubs = this.clientSubscriptions.get(client.id);
    if (clientSubs) {
      clientSubs.delete(actionId);
    }

    client.leave(`action-${actionId}`);
    this.logger.log(`Client ${client.id} unsubscribed from action ${actionId}`);
  }

  @SubscribeMessage('subscribe-actions')
  async handleSubscribeActions(
    @MessageBody() data: { actionIds: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const { actionIds } = data;

    if (
      !Array.isArray(actionIds) ||
      actionIds.some((id) => typeof id !== 'number')
    ) {
      client.emit('error', { message: 'Invalid actionIds array' });
      return;
    }

    const clientSubs = this.clientSubscriptions.get(client.id) || new Set();

    // Subscribe to each action
    for (const actionId of actionIds) {
      clientSubs.add(actionId);
      client.join(`action-${actionId}`);
    }

    this.clientSubscriptions.set(client.id, clientSubs);

    // Send initial counts for all actions
    const initialCounts =
      await this.actionsService.countCommittedBulk(actionIds);
    client.emit('actions-counts', initialCounts);

    this.logger.log(
      `Client ${client.id} subscribed to actions: ${actionIds.join(', ')}`,
    );
  }

  @SubscribeMessage('unsubscribe-actions')
  handleUnsubscribeActions(
    @MessageBody() data: { actionIds: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const { actionIds } = data;

    if (
      !Array.isArray(actionIds) ||
      actionIds.some((id) => typeof id !== 'number')
    ) {
      client.emit('error', { message: 'Invalid actionIds array' });
      return;
    }

    const clientSubs = this.clientSubscriptions.get(client.id);
    if (clientSubs) {
      actionIds.forEach((actionId) => {
        clientSubs.delete(actionId);
        client.leave(`action-${actionId}`);
      });
    }

    this.logger.log(
      `Client ${client.id} unsubscribed from actions: ${actionIds.join(', ')}`,
    );
  }

  private async handleActionDelta(data: { actionId: number; delta: number }) {
    const { actionId, delta } = data;

    // Get current count for this action
    const currentCount = await this.actionsService
      .countCommitted(actionId)
      .toPromise();

    // Emit to all clients subscribed to this action
    this.server.to(`action-${actionId}`).emit('action-count', {
      actionId,
      count: currentCount,
      delta,
    });

    this.logger.log(
      `Action ${actionId} count updated: ${currentCount} (delta: ${delta})`,
    );
  }
}
