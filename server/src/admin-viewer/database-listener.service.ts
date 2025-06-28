import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
@EventSubscriber()
export class DatabaseListenerService implements EntitySubscriberInterface, OnModuleInit {
  constructor(
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    // Register this subscriber with TypeORM
    this.dataSource.subscribers.push(this);
  }

  /**
   * Called after entity insertion.
   */
  afterInsert(event: InsertEvent<any>) {
    const tableName = event.metadata.tableName;
    const entity = event.entity;
    
    console.log(`Database insert detected in table: ${tableName}`);
    
    this.eventEmitter.emit('database.insert', {
      tableName,
      entity,
    });
  }

  /**
   * Called after entity update.
   */
  afterUpdate(event: UpdateEvent<any>) {
    const tableName = event.metadata.tableName;
    const entity = event.entity;
    
    console.log(`Database update detected in table: ${tableName}`);
    
    this.eventEmitter.emit('database.update', {
      tableName,
      entity,
    });
  }

  /**
   * Called after entity removal.
   */
  afterRemove(event: RemoveEvent<any>) {
    const tableName = event.metadata.tableName;
    const entityId = event.entityId;
    
    console.log(`Database delete detected in table: ${tableName}`);
    
    this.eventEmitter.emit('database.delete', {
      tableName,
      entityId,
    });
  }
}