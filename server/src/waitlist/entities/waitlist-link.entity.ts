import { Campaign } from "src/campaign/entities/campaign.entity";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

/** A reusable link that attributes waitlist entries to an organization. */
@Entity()
export class WaitlistLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  code: string;

  @Column()
  organizationId: number;

  @ManyToOne(() => Campaign)
  @JoinColumn({ name: "organizationId" })
  organization?: Relation<Campaign>;

  @Column()
  channel: string;

  @Column({ default: true })
  showReferralMessage: boolean;

  /** Staff-entered tracking metadata; publishes nothing. */
  @Column({ type: "timestamptz", nullable: true })
  publishedAt: Date | null;

  /** Archiving stops new entries through the link and keeps its history. */
  @Column({ type: "timestamptz", nullable: true })
  archivedAt: Date | null;

  @CreateDateColumnTz()
  createdAt: Date;
}
