import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { ActionUpdate } from 'src/actions/entities/action-update.entity';
import { Comment } from 'src/forum/entities/comment.entity';
import { Type } from 'class-transformer';
import { Ty } from 'src/tasks/entities/type';
import { OnetimeInvite } from 'src/user/entities/onetime-invite.entity';

export enum NotificationCategory {
  ActionEvent = 'action_event',
  ForumReply = 'forum_reply',
  FriendRequest = 'friend_request',
  FriendRequestAccepted = 'friend_request_accepted',
  ActionUpdate = 'action_update',
  Likes = 'likes',
  CommunityInviteRejected = 'community_invite_rejected',
  CommunityInviteAccepted = 'community_invite_accepted',
  OnetimeInviteRequestCreated = 'onetime_invite_request_created',
  OnetimeInviteRequestApproved = 'onetime_invite_request_approved',
  OnetimeInviteRequestRejected = 'onetime_invite_request_rejected',
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, (user) => user.notifications, {
    onDelete: 'CASCADE',
  })
  user: Ty<User>;

  @ManyToMany(() => User)
  @JoinTable({ name: 'notification_associated_users' })
  associatedUsers?: Ty<User>[];

  @Column({ type: 'enum', enum: NotificationCategory })
  @ApiProperty({ enum: NotificationCategory, enumName: 'NotificationCategory' })
  category: NotificationCategory;

  @Column()
  @ApiProperty()
  message: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  targetContent?: string;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  webAppLocation: string;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  mobileAppLocation: string;

  @Column({ default: false })
  @ApiProperty()
  read: boolean;

  @Column({ default: false })
  @ApiProperty()
  cleared: boolean;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({ type: Date })
  @Type(() => Date)
  sendTime: Date;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  groupingKey?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  groupingCount?: number;

  @ApiPropertyOptional({ type: () => ActionUpdate })
  @ManyToOne(() => ActionUpdate, (actionUpdate) => actionUpdate.notifs, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  actionUpdate?: Ty<ActionUpdate>;

  @ApiPropertyOptional({ type: () => Comment })
  @ManyToOne(() => Comment, (comment) => comment.notifications, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  comment?: Ty<Comment>;

  @ApiPropertyOptional({ type: () => OnetimeInvite })
  @ManyToOne(() => OnetimeInvite, (invite) => invite.notifs, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  onetimeInvite?: Ty<OnetimeInvite>;
}
