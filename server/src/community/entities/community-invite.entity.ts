import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { Community } from './community.entity';
import type { Relation } from 'src/utils/Repository';
import { Notification } from 'src/notifs/entities/notification.entity';

export enum CommunityInviteStatus {
  RequestPending = 'request_pending',
  RequestRejected = 'request_rejected',
  InviteePending = 'invitee_pending',
  InviteeAccepted = 'invitee_accepted',
  InviteeRejected = 'invitee_rejected',
  Cancelled = 'cancelled',
}

@Entity()
export class CommunityInvite {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({
    type: 'enum',
    enum: CommunityInviteStatus,
  })
  @ApiProperty({
    enum: CommunityInviteStatus,
    enumName: 'CommunityInviteStatus',
  })
  @Allow()
  status: CommunityInviteStatus;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  @IsOptional()
  deletedAt: Date | null;

  // Relations

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @ApiPropertyOptional({ type: () => User })
  @Type(() => User)
  @JoinColumn({ name: 'invitingUserId' })
  @IsOptional()
  invitingUser?: Relation<User>;

  @ManyToOne(() => User, (user) => user.invitedCommunities, {
    onDelete: 'CASCADE',
  })
  @ApiProperty({ type: () => User })
  @Type(() => User)
  @JoinColumn({ name: 'invitedUserId' })
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  invitedUser: Relation<User>;

  @ManyToOne(() => Community, (community) => community.internalInvites, {
    onDelete: 'CASCADE',
  })
  @ApiProperty({ type: () => Community })
  @Type(() => Community)
  @JoinColumn({ name: 'communityId' })
  @IsDefined()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  community: Relation<Community>;

  @OneToMany(() => Notification, (notif) => notif.communityInvite)
  @Type(() => Notification)
  @ApiPropertyOptional({ type: () => Notification, isArray: true })
  @Allow()
  @IsOptional()
  notifs?: Relation<Notification>[];
}
