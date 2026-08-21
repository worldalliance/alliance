import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import { CommunityInvite } from "src/community/entities/community-invite.entity";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Comment } from "src/forum/entities/comment.entity";
import type { Push } from "src/push/push.entity";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

export enum NotificationCategory {
  ActionEvent = "action_event",
  ForumReply = "forum_reply",
  FriendRequest = "friend_request",
  FriendRequestAccepted = "friend_request_accepted",
  ActionUpdate = "action_update",
  Likes = "likes",
  RemovedFromCommunity = "removed_from_community",
  RemovedFromCommunityForLeader = "removed_from_community_for_leader",
  MemberLeftCommunity = "member_left_community",
  MemberSuspendedRemovedFromCommunity = "member_suspended_removed_from_community",
  MemberJoinedCommunity = "member_joined_community",
  CommunityAssigned = "community_assigned",
  NewMemberReferred = "new_member_referred",

  // Legacy
  CommunityInviteCreated = "community_invite_created",
  CommunityInviteRejected = "community_invite_rejected",
  CommunityInviteAccepted = "community_invite_accepted",
  OnetimeInviteRequestCreated = "onetime_invite_request_created",
  OnetimeInviteRequestApproved = "onetime_invite_request_approved",
  OnetimeInviteRequestRejected = "onetime_invite_request_rejected",
  CommunityInviteRequestCreated = "community_invite_request_created",
  CommunityInviteRequestRejected = "community_invite_request_rejected",
}

export enum NotifPriority {
  Low = "low",
  High = "high",
}

export const NOTIFICATION_CATEGORY_PRIORITIES = {
  [NotificationCategory.ActionEvent]: NotifPriority.Low,
  [NotificationCategory.ForumReply]: NotifPriority.High,
  [NotificationCategory.FriendRequest]: NotifPriority.High,
  [NotificationCategory.FriendRequestAccepted]: NotifPriority.Low,
  [NotificationCategory.ActionUpdate]: NotifPriority.High,
  [NotificationCategory.Likes]: NotifPriority.Low,
  [NotificationCategory.RemovedFromCommunity]: NotifPriority.High,
  [NotificationCategory.RemovedFromCommunityForLeader]: NotifPriority.High,
  [NotificationCategory.MemberLeftCommunity]: NotifPriority.High,
  [NotificationCategory.MemberSuspendedRemovedFromCommunity]:
    NotifPriority.High,
  [NotificationCategory.MemberJoinedCommunity]: NotifPriority.High,
  [NotificationCategory.CommunityAssigned]: NotifPriority.High,
  [NotificationCategory.NewMemberReferred]: NotifPriority.High,

  // Legacy
  [NotificationCategory.CommunityInviteCreated]: NotifPriority.Low,
  [NotificationCategory.CommunityInviteRejected]: NotifPriority.High,
  [NotificationCategory.CommunityInviteAccepted]: NotifPriority.High,
  [NotificationCategory.OnetimeInviteRequestCreated]: NotifPriority.Low,
  [NotificationCategory.OnetimeInviteRequestApproved]: NotifPriority.High,
  [NotificationCategory.OnetimeInviteRequestRejected]: NotifPriority.High,
  [NotificationCategory.CommunityInviteRequestCreated]: NotifPriority.Low,
  [NotificationCategory.CommunityInviteRequestRejected]: NotifPriority.High,
} satisfies Record<NotificationCategory, NotifPriority>;

@Entity()
@Index("IDX_notification_user_groupingKey_category", [
  "user",
  "groupingKey",
  "category",
])
export class Notification {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({ type: "enum", enum: NotificationCategory })
  @ApiProperty({ enum: NotificationCategory, enumName: "NotificationCategory" })
  category: NotificationCategory;

  @Column()
  @ApiProperty()
  message: string;

  @Column({ type: "enum", enum: NotifPriority, default: NotifPriority.Low })
  @ApiProperty({ enum: NotifPriority, enumName: "NotifPriority" })
  priority: NotifPriority;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  targetContent: string | null;

  @Column()
  @ApiProperty()
  webAppLocation: string;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  mobileAppLocation: string | null;

  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  readAt: Date | null;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  @ApiProperty({ type: Date })
  @Type(() => Date)
  sendTime: Date;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  groupingKey: string | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  groupingCount: number | null;

  @Column({ default: true })
  @ApiProperty()
  shouldPush: boolean;

  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  pushDispatchedAt: Date | null;

  @Column({ type: "text", nullable: true })
  @ApiProperty({ nullable: true })
  pushClaimedBy: string | null;

  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  pushClaimedAt: Date | null;

  // Relations

  @ManyToOne(() => User, (user) => user.notifications, {
    nullable: false,
    onDelete: "CASCADE",
  })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @ManyToMany(() => User)
  @JoinTable({ name: "notification_associated_users" })
  associatedUsers?: Relation<User>[];

  @OneToMany("Push", "notification", {
    nullable: true,
    onDelete: "CASCADE",
  })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  pushes: Relation<Push>[];

  @ApiPropertyOptional({ type: () => ActionUpdate })
  @ManyToOne(() => ActionUpdate, (actionUpdate) => actionUpdate.notifs, {
    nullable: true,
    onDelete: "CASCADE",
  })
  actionUpdate?: Relation<ActionUpdate>;

  @ApiPropertyOptional({ type: () => Comment })
  @ManyToOne(() => Comment, (comment) => comment.notifications, {
    nullable: true,
    onDelete: "CASCADE",
  })
  comment?: Relation<Comment>;

  @ApiPropertyOptional({ type: () => OnetimeInvite })
  @ManyToOne(() => OnetimeInvite, (invite) => invite.notifs, {
    nullable: true,
    onDelete: "CASCADE",
  })
  onetimeInvite?: Relation<OnetimeInvite>;

  @ApiPropertyOptional({ type: () => CommunityInvite })
  @ManyToOne(() => CommunityInvite, (invite) => invite.notifs, {
    nullable: true,
    onDelete: "CASCADE",
  })
  communityInvite?: Relation<CommunityInvite>;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ nullable: true })
  cid: string | null;
}
