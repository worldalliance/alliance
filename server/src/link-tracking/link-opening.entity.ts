import { LinkOpeningPlatform } from "@alliance/common/linkOpening";
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
import { MessageTracking } from "./message-tracking.entity";

/** One arrival in an app through a tracked link. */
@Entity()
export class LinkOpening {
  @PrimaryGeneratedColumn()
  id: number;

  /** Chosen by the client once per arrival, so its retries insert nothing more. */
  @Index({ unique: true })
  @Column({ type: "uuid" })
  openingId: string;

  /** Null for a legacy link with no recoverable recipient. */
  @Index()
  @Column({ type: "integer", nullable: true })
  messageTrackingId: number | null;

  @ManyToOne(() => MessageTracking, { onDelete: "CASCADE" })
  @JoinColumn({ name: "messageTrackingId" })
  messageTracking?: Relation<MessageTracking>;

  /** As `normalizeDestination` gives it. */
  @Column()
  destination: string;

  @Column({ type: "enum", enum: LinkOpeningPlatform })
  platform: LinkOpeningPlatform;

  /** When the client saw the arrival, which a retry may report much later. */
  @Column({ type: "timestamptz" })
  observedAt: Date;

  @CreateDateColumnTz()
  receivedAt: Date;
}
