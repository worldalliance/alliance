import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Action } from './action.entity';
import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  All = 'all',
  Joined = 'joined',
  None = 'none',
}

export enum ActionStatus {
  Draft = 'draft',
  Upcoming = 'upcoming',
  GatheringCommitments = 'gathering_commitments',
  CommitmentsReached = 'commitments_reached', // all commitments have been reached, actions not yet started
  MemberAction = 'member_action', // all committed members start doing the action
  Resolution = 'resolution', // member action done, office working on resolution
  Completed = 'completed', // resolution done
  Failed = 'failed', // resolution failed
  Abandoned = 'abandoned', // process aborted
}

@Entity()
export class ActionEvent {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the action event' })
  id: number;

  @IsNotEmpty()
  @Column()
  @ApiProperty({ description: 'Title of the event' })
  title: string;

  @Column()
  @ApiProperty({ description: 'secondary text' })
  description: string;

  @Column({ type: 'enum', enum: ActionStatus, default: ActionStatus.Draft })
  @IsNotEmpty()
  @ApiProperty({
    description: 'New status of the action after the event',
    enum: ActionStatus,
  })
  newStatus: ActionStatus;

  @Column({ type: 'text' })
  @IsNotEmpty()
  @ApiProperty({
    description: 'Notification type for the event',
    enum: NotificationType,
  })
  sendNotifsTo: NotificationType;

  @Column()
  @ApiProperty({ description: 'time of the event (for display)' })
  date: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Timestamp when the event was last updated' })
  updatedAt: Date;

  @Column({ default: false })
  @ApiProperty({
    description: 'Indicates whether the event should be shown in the timeline',
    default: false,
  })
  showInTimeline: boolean;

  @ManyToOne(() => Action, (action) => action.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actionId' })
  @ApiProperty({
    description: 'The action associated with this event',
    type: () => Action,
  })
  action: Action;
}
