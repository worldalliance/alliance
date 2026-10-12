import { Campaign } from "src/campaign/entities/campaign.entity";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WaitlistLink } from "./waitlist-link.entity";

/** The heuristic sets `Clean` or `Suspected`; staff set `Spam` or `NotSpam`. */
export enum WaitlistSpamStatus {
  Clean = "clean",
  Suspected = "suspected",
  Spam = "spam",
  NotSpam = "not_spam",
}

/** A person waiting to join, separate from any account. */
@Entity()
// migration:generate drops backslashes from CHECK expressions, so match
// whitespace with a POSIX class rather than \s.
@Check(
  "CHK_waitlist_entry_email_trimmed",
  `"email" !~ '^[[:space:]]|[[:space:]]$'`,
)
@Check(
  "CHK_waitlist_entry_one_contact",
  `("email" IS NULL) <> ("phoneNumber" IS NULL)`,
)
@Check(
  "CHK_waitlist_entry_phone_e164",
  `"phoneNumber" ~ '^[+][1-9][0-9]{1,14}$'`,
)
export class WaitlistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column({ type: "citext", nullable: true })
  email: string | null;

  @Index({ unique: true })
  @Column({ type: "varchar", nullable: true })
  phoneNumber: string | null;

  @Column({ type: "text", nullable: true })
  reason: string | null;

  @Column({ type: "timestamptz", nullable: true })
  committedAt: Date | null;

  /** The personal sharing code others join through. */
  @Index({ unique: true })
  @Column()
  code: string;

  @Index()
  @Column({ nullable: true })
  organizationId: number | null;

  @ManyToOne(() => Campaign, { nullable: true })
  @JoinColumn({ name: "organizationId" })
  organization?: Relation<Campaign> | null;

  /** The organization link the referral chain started from. */
  @Index()
  @Column({ nullable: true })
  sourceLinkId: number | null;

  @ManyToOne(() => WaitlistLink, { nullable: true })
  @JoinColumn({ name: "sourceLinkId" })
  sourceLink?: Relation<WaitlistLink> | null;

  /** The entry whose personal link this one joined through. */
  @Index()
  @Column({ nullable: true })
  referrerId: number | null;

  @ManyToOne(() => WaitlistEntry, { nullable: true })
  @JoinColumn({ name: "referrerId" })
  referrer?: Relation<WaitlistEntry> | null;

  @Column({ type: "timestamptz", nullable: true })
  mobilizedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  unsubscribedAt: Date | null;

  @Column({
    type: "enum",
    enum: WaitlistSpamStatus,
    default: WaitlistSpamStatus.Clean,
  })
  spamStatus: WaitlistSpamStatus;

  /** Carried by the unsubscribe link, since the personal code is public. */
  @Index({ unique: true })
  @Column({ type: "uuid" })
  @Generated("uuid")
  unsubscribeToken: string;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
