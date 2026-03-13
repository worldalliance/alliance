import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import type { Ty } from 'src/tasks/entities/type';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';

export enum EventType {
  AccountCreated = 'account_created',
  ContractSigned = 'contract_signed',
  ContractSuspended = 'contract_suspended',
  SmsUnsubscribe = 'sms_unsubscribe',
  SmsInbound = 'sms_inbound',
  SmsFailure = 'sms_failure',
  ForumActionAutocomplete = 'forum_action_autocomplete',
  ActionComment = 'action_comment',
  ForumReplyNotifFailure = 'forum_reply_notif_failure',
  ActionOptOut = 'action_opt_out',
}

export const SEND_TO_SLACK: Record<EventType, boolean> = {
  [EventType.AccountCreated]: true,
  [EventType.ContractSigned]: true,
  [EventType.ContractSuspended]: true,
  [EventType.SmsUnsubscribe]: true,
  [EventType.SmsInbound]: true,
  [EventType.SmsFailure]: true,
  [EventType.ForumActionAutocomplete]: true,
  [EventType.ActionComment]: true,
  [EventType.ForumReplyNotifFailure]: false,
  [EventType.ActionOptOut]: true,
};

@Entity()
export class EventLog {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column({ type: 'enum', enum: EventType })
  @ApiProperty({ enum: EventType, enumName: 'EventType' })
  event: EventType;

  @Column()
  @ApiProperty()
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  @ApiPropertyOptional()
  blob?: Record<string, unknown>;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  @ApiPropertyOptional({ type: () => User })
  user?: Ty<User>;

  @RelationId((event: EventLog) => event.user)
  @ApiPropertyOptional()
  userId?: number;
}
