import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsNotEmpty } from 'class-validator';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Action } from './action.entity';
import { UpdateDateColumnTz } from 'src/datasources/basecolumns';
import { ActionUpdate } from './action-update.entity';

export enum NotificationType {
  All = 'all',
  Joined = 'joined',
  None = 'none',
}

export enum ActionStatus {
  Draft = 'draft',
  Upcoming = 'upcoming',
  GatheringCommitments = 'gathering_commitments',
  OfficeAction = 'office_action', // all commitments have been reached, actions not yet started
  MemberAction = 'member_action', // all committed members start doing the action
  Resolution = 'resolution', // member action done, office working on resolution
  Completed = 'completed', // resolution done
  Failed = 'failed', // resolution failed
  Abandoned = 'abandoned', // process aborted
}

export const readableActionStatus: Record<ActionStatus, string> = {
  [ActionStatus.Draft]: 'Draft',
  [ActionStatus.Upcoming]: 'Upcoming',
  [ActionStatus.GatheringCommitments]: 'Gathering commitments',
  [ActionStatus.OfficeAction]: 'Office action',
  [ActionStatus.MemberAction]: 'Members taking action',
  [ActionStatus.Resolution]: 'Resolution ongoing',
  [ActionStatus.Completed]: 'Completed',
  [ActionStatus.Failed]: 'Failed',
  [ActionStatus.Abandoned]: 'Abandoned',
};

@Entity()
export class ActionEvent {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the action event' })
  @Allow()
  id: number;

  @IsNotEmpty()
  @Column()
  @ApiProperty({ description: 'Title of the event' })
  title: string;

  @Column()
  @ApiProperty({ description: 'secondary text' })
  @Allow()
  description: string;

  @Column({ type: 'enum', enum: ActionStatus, default: ActionStatus.Draft })
  @IsNotEmpty()
  @ApiProperty({
    description: 'New status of the action after the event',
    enum: ActionStatus,
    enumName: 'ActionStatus',
  })
  newStatus: ActionStatus;

  @Column({ type: 'timestamptz' })
  @ApiProperty({ description: 'time of the event (for display)' })
  @IsNotEmpty()
  @Type(() => Date)
  date: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ description: 'Timestamp when the event was last updated' })
  @Type(() => Date)
  @Allow()
  updatedAt: Date;

  @Column({ default: false })
  @ApiProperty({
    description: 'Indicates whether the event should be shown in the timeline',
    default: false,
  })
  @IsNotEmpty()
  showInTimeline: boolean;

  @ManyToOne(() => Action, (action) => action.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actionId' })
  @ApiProperty({
    description: 'The action associated with this event',
    type: () => Action,
    nullable: false,
  })
  @IsDefined()
  @Allow()
  @Type(() => Action)
  action: Action;

  @OneToMany(() => ActionUpdate, (update) => update.associatedEvent)
  @ApiProperty({ type: ActionUpdate, isArray: true })
  @Type(() => ActionUpdate)
  @Allow()
  updates: ActionUpdate[];

  @ApiProperty()
  @Column({ default: false })
  @Allow()
  suiteManaged: boolean;
}
