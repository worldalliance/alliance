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

/** A reviewer's set of transcripts. Its id is the batchId the review tool echoes in its export. */
@Entity()
export class KoraAssignment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "uuid" })
  reviewerId: string;

  @ManyToOne(() => KoraReviewer, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reviewerId" })
  reviewer?: Relation<KoraReviewer>;

  /** Requested after the reviewer finished an earlier assignment. */
  @Column({ type: "boolean" })
  extra: boolean;

  /** The newest batch when the assignment was made; deleting that batch deletes the assignment. */
  @Column({ type: "uuid" })
  schemaBatchId: string;

  @ManyToOne(() => KoraBatch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "schemaBatchId" })
  schemaBatch?: Relation<KoraBatch>;

  /** The tool's latest export, after free-text redaction; null until the first save. */
  @Column({ type: "jsonb", nullable: true })
  export: unknown | null;

  /** Creation or the latest save. Unreviewed transcripts are released after 7 days without one. */
  @Column({ type: "timestamptz" })
  lastActivityAt: Date;

  /**
   * The earliest closesAt of its transcripts' batches, null when none has one.
   * After it the assignment can't be continued and its unreviewed transcripts are released.
   */
  @Column({ type: "timestamptz", nullable: true })
  closesAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
