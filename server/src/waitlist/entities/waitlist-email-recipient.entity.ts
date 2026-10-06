import {
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { WaitlistEmailSkipReason } from "../waitlist-email-audience";
import { WaitlistEmailBatch } from "./waitlist-email-batch.entity";
import { WaitlistEntry } from "./waitlist-entry.entity";

export enum WaitlistEmailRecipientStatus {
  Pending = "pending",
  /** Handed to the mail server with no answer recorded yet. */
  Sending = "sending",
  /** The mail server accepted it; delivery is not known. */
  Sent = "sent",
  Failed = "failed",
  /** Sending stopped without an answer, so the email may have gone out. */
  Uncertain = "uncertain",
  Skipped = "skipped",
}

@Entity()
@Unique(["batchId", "entryId"])
@Check(
  "CHK_waitlist_email_recipient_skip_reason",
  `("status" = 'skipped') = ("skipReason" IS NOT NULL)`,
)
export class WaitlistEmailRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  batchId: number;

  @ManyToOne(() => WaitlistEmailBatch)
  @JoinColumn({ name: "batchId" })
  batch?: Relation<WaitlistEmailBatch>;

  @Index()
  @Column()
  entryId: number;

  @ManyToOne(() => WaitlistEntry)
  @JoinColumn({ name: "entryId" })
  entry?: Relation<WaitlistEntry>;

  @Index()
  @Column({
    type: "enum",
    enum: WaitlistEmailRecipientStatus,
    default: WaitlistEmailRecipientStatus.Pending,
  })
  status: WaitlistEmailRecipientStatus;

  @Column({ type: "enum", enum: WaitlistEmailSkipReason, nullable: true })
  skipReason: WaitlistEmailSkipReason | null;

  /** The invite `#{signupLink}` pointed to. */
  @Column({ nullable: true })
  inviteId: number | null;

  @ManyToOne(() => OnetimeInvite, { nullable: true })
  @JoinColumn({ name: "inviteId" })
  invite?: Relation<OnetimeInvite> | null;

  @Column({ type: "text", nullable: true })
  renderedSubject: string | null;

  @Column({ type: "text", nullable: true })
  renderedHtml: string | null;

  @Column({ type: "text", nullable: true })
  error: string | null;

  @Column({ type: "timestamptz", nullable: true })
  attemptedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  acceptedAt: Date | null;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
