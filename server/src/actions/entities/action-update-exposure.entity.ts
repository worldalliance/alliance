import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { ExperimentArm } from "src/notifs/entities/experiment-assignment.entity";
import { UnreadContent } from "src/notifs/entities/unread-content.entity";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { z } from "zod";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
} from "./action-update.entity";

/** A: the member's own contribution. B: the collective result alone. */
export enum RecognitionBranch {
  A = "a",
  B = "b",
}

export const recognitionCopySchema = z.strictObject({
  inApp: z.string(),
  push: z.string(),
  sms: z.string(),
  emailSubject: z.string(),
  /** Plain text; escape before it reaches HTML. */
  emailBody: z.string(),
});
export type RecognitionCopy = z.infer<typeof recognitionCopySchema>;

/**
 * One recipient of a recognition update. Created at send with only the
 * update and member; the rest is frozen together when delivery comes due.
 * Push outcomes are the `Push` rows of `unreadContent`.
 */
@Entity()
@Index(["actionUpdateId", "userId"], { unique: true })
export class ActionUpdateExposure {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ActionUpdate, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "actionUpdateId" })
  actionUpdate?: Relation<ActionUpdate>;

  @Column()
  actionUpdateId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @Column()
  userId: number;

  @Column({
    type: "enum",
    enum: ActionUpdateNotificationMode,
    enumName: "ActionUpdateNotificationMode",
    nullable: true,
  })
  mode: ActionUpdateNotificationMode | null;

  @Column({
    type: "enum",
    enum: ExperimentArm,
    enumName: "ExperimentArm",
    nullable: true,
  })
  assignedArm: ExperimentArm | null;

  @Column({ type: "boolean", nullable: true })
  completed: boolean | null;

  @Column({
    type: "enum",
    enum: RecognitionBranch,
    enumName: "RecognitionBranch",
    nullable: true,
  })
  branch: RecognitionBranch | null;

  @Column({ type: "text", nullable: true })
  contribution: string | null;

  @Column({ type: "integer", nullable: true })
  weeksAgo: number | null;

  /** `RecognitionCopy`. */
  @Column({ type: "jsonb", nullable: true })
  copy: unknown | null;

  /** The shared tracking ID of an exposure prepared before each message got
   * its own; no longer written. */
  @Column({ type: "varchar", nullable: true })
  cid: string | null;

  @Column({ type: "timestamptz", nullable: true })
  preparedAt: Date | null;

  @OneToOne(() => UnreadContent, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "unreadContentId" })
  unreadContent?: Relation<UnreadContent> | null;

  @Column({ type: "integer", nullable: true })
  unreadContentId: number | null;

  @Column({ type: "timestamptz", nullable: true })
  deliveryClaimedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  deliveredAt: Date | null;

  /** Set when the recipient couldn't see the entry at delivery, so no channel reached them. */
  @Column({ type: "timestamptz", nullable: true })
  hiddenAt: Date | null;

  @OneToOne(() => Mail, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "mailId" })
  mail?: Relation<Mail> | null;

  @OneToOne(() => Mms, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "mmsId" })
  mms?: Relation<Mms> | null;

  /** Set when the email was attempted and failed, so `mail` stays null. */
  @Column({ type: "timestamptz", nullable: true })
  emailFailedAt: Date | null;

  /** Set when the text was attempted and failed, so `mms` stays null. */
  @Column({ type: "timestamptz", nullable: true })
  textFailedAt: Date | null;

  @CreateDateColumnTz()
  createdAt: Date;
}
