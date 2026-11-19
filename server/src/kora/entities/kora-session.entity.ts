import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { KoraBatch } from "./kora-batch.entity";
import { KoraReviewer } from "./kora-reviewer.entity";

/** One sitting of about 45 minutes. Its id is the sessionId the review tool echoes in its export. */
@Entity()
export class KoraSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "uuid" })
  reviewerId: string;

  @ManyToOne(() => KoraReviewer, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reviewerId" })
  reviewer?: Relation<KoraReviewer>;

  /** 1-based for this reviewer. The first session carries the practice conversations. */
  @Column({ type: "int" })
  number: number;

  /** What this session may spend, against each conversation's weight in load units. */
  @Column({ type: "real" })
  budgetUnits: number;

  /** The newest batch when the session started; deleting that batch deletes the session. */
  @Column({ type: "uuid" })
  schemaBatchId: string;

  @ManyToOne(() => KoraBatch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "schemaBatchId" })
  schemaBatch?: Relation<KoraBatch>;

  /** The tool's latest export, after free-text redaction; null until the first save. */
  @Column({ type: "jsonb", nullable: true })
  export: unknown | null;

  /** Creation or the latest save. Unfinished conversations are released after the window without one. */
  @Column({ type: "timestamptz" })
  lastActivityAt: Date;

  /**
   * The earliest closesAt of its conversations' batches, null when none has one.
   * After it the session can't be continued and its unfinished conversations are released.
   */
  @Column({ type: "timestamptz", nullable: true })
  closesAt: Date | null;

  /** When the reviewer reached the end of the session, feedback included. */
  @Column({ type: "timestamptz", nullable: true })
  endedAt: Date | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
