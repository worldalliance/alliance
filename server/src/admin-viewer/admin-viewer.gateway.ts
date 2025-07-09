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
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/admin-viewer',
})
export class AdminViewerGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private subscriptions: Map<string, Set<string>> = new Map(); // tableName -> Set<socketId>
  private readonly logger = new Logger(AdminViewerGateway.name);

  constructor(private eventEmitter: EventEmitter2) {
    // Listen for database change events
    this.eventEmitter.on(
      'database.insert',
      this.handleDatabaseInsert.bind(this),
    );
    this.eventEmitter.on(
      'database.update',
      this.handleDatabaseUpdate.bind(this),
    );
    this.eventEmitter.on(
      'database.delete',
      this.handleDatabaseDelete.bind(this),
    );
  }

  handleConnection() {}

  handleDisconnect(client: Socket) {
    this.subscriptions.forEach((socketIds, tableName) => {
      socketIds.delete(client.id);
      if (socketIds.size === 0) {
        this.subscriptions.delete(tableName);
      }
    });
  }

  @SubscribeMessage('subscribe-table')
  handleSubscribeTable(
    @MessageBody() data: { tableName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { tableName } = data;

    // Remove client from all existing subscriptions
    this.subscriptions.forEach((socketIds) => {
      socketIds.delete(client.id);
    });

    // Add client to new table subscription
    if (!this.subscriptions.has(tableName)) {
      this.subscriptions.set(tableName, new Set());
    }
    this.subscriptions.get(tableName)!.add(client.id);

    this.logger.log(`Client ${client.id} subscribed to table: ${tableName}`);

    return { status: 'subscribed', tableName };
  }

  @SubscribeMessage('unsubscribe-table')
  handleUnsubscribeTable(
    @MessageBody() data: { tableName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { tableName } = data;

    if (this.subscriptions.has(tableName)) {
      this.subscriptions.get(tableName)!.delete(client.id);
      if (this.subscriptions.get(tableName)!.size === 0) {
        this.subscriptions.delete(tableName);
      }
    }

    this.logger.log(
      `Client ${client.id} unsubscribed from table: ${tableName}`,
    );

    return { status: 'unsubscribed', tableName };
  }

  private handleDatabaseInsert(event: { tableName: string; entity: unknown }) {
    this.emitToTableSubscribers(event.tableName, 'row-inserted', {
      tableName: event.tableName,
      entity: event.entity,
    });
  }

  private handleDatabaseUpdate(event: { tableName: string; entity: unknown }) {
    this.emitToTableSubscribers(event.tableName, 'row-updated', {
      tableName: event.tableName,
      entity: event.entity,
    });
  }

  private handleDatabaseDelete(event: {
    tableName: string;
    entityId: unknown;
  }) {
    this.emitToTableSubscribers(event.tableName, 'row-deleted', {
      tableName: event.tableName,
      entityId: event.entityId,
    });
  }

  private emitToTableSubscribers(
    tableName: string,
    event: string,
    data: unknown,
  ) {
    const subscribers = this.subscriptions.get(tableName);
    if (subscribers) {
      subscribers.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }
}
