import { CreateDateColumnTz } from "src/datasources/basecolumns";
import {
  ActionEventNotif,
  ActionEventNotifType,
  MissedSuiteNoticeCopy,
} from "src/notifs/entities/action-event-notif.entity";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import { WaitlistEntry } from "src/waitlist/entities/waitlist-entry.entity";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { z } from "zod";

export enum MessageChannel {
  Email = "email",
  Sms = "sms",
  /** A legacy link whose ID both an email and a text carried. */
  Unknown = "unknown",
}

export enum MessageSource {
  ActionReminder = "action_reminder",
  MissedSuiteNotice = "missed_suite_notice",
  ActionAnnouncement = "action_announcement",
  ForumReply = "forum_reply",
  ForumDigest = "forum_digest",
  WaitlistCampaign = "waitlist_campaign",
  ActionUpdate = "action_update",
  ContractReminder = "contract_reminder",
}

export const NOTIF_SOURCE: Record<ActionEventNotifType, MessageSource> = {
  [ActionEventNotifType.Announcement]: MessageSource.ActionAnnouncement,
  [ActionEventNotifType.Reminder]: MessageSource.ActionReminder,
  [ActionEventNotifType.PersonalReminder]: MessageSource.ActionReminder,
  [ActionEventNotifType.MissedDeadline]: MessageSource.MissedSuiteNotice,
};

const id = z.number().int();

/** What the message was about, as of sending; edits to its source leave it be. */
export const messageContextSchema = z
  .object({
    reminderGroupId: id,
    reminderGroupName: z.string(),
    actionId: id,
    actionName: z.string(),
    actionSuiteId: id,
    actionUpdateId: id,
    notifiedActionIds: z.array(id),
    missNumber: id,
    missedSuiteCopy: z.enum(MissedSuiteNoticeCopy),
    postId: id,
    commentId: id,
    notificationIds: z.array(id),
    waitlistEmailBatchId: id,
    waitlistEmailRecipientId: id,
    subject: z.string(),
  })
  .partial()
  .strict();
export type MessageContext = z.infer<typeof messageContextSchema>;

export const reminderContext = (params: {
  group: { id: number; name: string } | null;
  action: { id: number; name: string } | null;
  notifiedActionIds: number[] | null;
  actionSuiteId: number | null;
  missNumber: number | null;
  missedSuiteCopy: MissedSuiteNoticeCopy | null;
}): MessageContext => ({
  reminderGroupId: params.group?.id,
  reminderGroupName: params.group?.name,
  actionId: params.action?.id,
  actionName: params.action?.name,
  notifiedActionIds: params.notifiedActionIds ?? undefined,
  actionSuiteId: params.actionSuiteId ?? undefined,
  missNumber: params.missNumber ?? undefined,
  missedSuiteCopy: params.missedSuiteCopy ?? undefined,
});

/**
 * Who a tracked message went to and why. A message's links carry its
 * `trackingId` as `cid`, and its `Mail` or `Mms` row has the same `cid`.
 */
@Entity()
@Check(
  "CHK_message_tracking_one_owner",
  `num_nonnulls("userId", "waitlistEntryId") = 1`,
)
export class MessageTracking {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  trackingId: string;

  @Column({ type: "enum", enum: MessageChannel })
  channel: MessageChannel;

  /**
   * Recovered on its first opening from a link sent before tracking; its
   * context is as of that opening.
   */
  @Column({ default: false })
  legacy: boolean;

  @Column({ type: "enum", enum: MessageSource })
  source: MessageSource;

  @Index()
  @Column({ type: "int", nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "userId" })
  user?: Relation<User> | null;

  @Index()
  @Column({ type: "int", nullable: true })
  waitlistEntryId: number | null;

  @ManyToOne(() => WaitlistEntry, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "waitlistEntryId" })
  waitlistEntry?: Relation<WaitlistEntry> | null;

  @Index()
  @Column({ type: "int", nullable: true })
  actionEventNotifId: number | null;

  @ManyToOne(() => ActionEventNotif, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "actionEventNotifId" })
  actionEventNotif?: Relation<ActionEventNotif> | null;

  @Column({ type: "jsonb" })
  context: unknown;

  @CreateDateColumnTz()
  createdAt: Date;
}
