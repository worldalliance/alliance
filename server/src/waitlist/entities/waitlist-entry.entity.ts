import { Campaign } from "src/campaign/entities/campaign.entity";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WaitlistLink } from "./waitlist-link.entity";

/** A person waiting to join, separate from any account. */
@Entity()
// migration:generate drops backslashes from CHECK expressions, so match
// whitespace with a POSIX class rather than \s.
@Check(
  "CHK_waitlist_entry_reason",
  `"organizationId" IS NOT NULL OR coalesce("reason", '') ~ '[^[:space:]]'`,
)
@Check(
  "CHK_waitlist_entry_email_trimmed",
  `"email" !~ '^[[:space:]]|[[:space:]]$'`,
)
export class WaitlistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column({ type: "citext" })
  email: string;

  @Column({ type: "text", nullable: true })
  reason: string | null;

  @Column({ type: "timestamptz" })
  committedAt: Date;

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

  @CreateDateColumnTz()
  createdAt: Date;
}
