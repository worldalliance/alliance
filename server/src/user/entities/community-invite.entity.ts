import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { Community } from './community.entity';
import { Ty } from 'src/tasks/entities/type';

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
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @ManyToOne(() => User, { nullable: true })
  @ApiPropertyOptional({ type: () => User })
  @Type(() => User)
  @JoinColumn({ name: 'invitingUserId' })
  @IsOptional()
  invitingUser?: Ty<User>;

  @ManyToOne(() => User, (user) => user.invitedCommunities)
  @ApiProperty({ type: () => User })
  @Type(() => User)
  @JoinColumn({ name: 'invitedUserId' })
  @Allow()
  invitedUser: Ty<User>;

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

  @ManyToOne(() => Community, (community) => community.internalInvites, {
    onDelete: 'CASCADE',
  })
  @ApiProperty({ type: () => Community })
  @Type(() => Community)
  @JoinColumn({ name: 'communityId' })
  @IsDefined()
  community: Ty<Community>;
}
