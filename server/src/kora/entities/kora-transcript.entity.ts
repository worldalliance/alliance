import { ApiProperty } from "@nestjs/swagger";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { KoraBatch } from "./kora-batch.entity";

/** One pair of conversations to review, keyed by KORA's transcriptId. */
@Entity()
@Index(["batchId", "position"], { unique: true })
export class KoraTranscript {
  @PrimaryColumn({ type: "varchar" })
  @ApiProperty()
  id: string;

  @Column({ type: "uuid" })
  batchId: string;

  @ManyToOne(() => KoraBatch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "batchId" })
  batch?: Relation<KoraBatch>;

  /** The line's order in its upload, from 0. */
  @Column({ type: "int" })
  position: number;

  @Column({ type: "varchar" })
  @ApiProperty()
  category: string;

  /** The converted transcript, valid against the review tool's transcriptSchema when stored. */
  @Column({ type: "jsonb" })
  content: unknown;

  /** "sha256:<hex>" of JSON.stringify(content); exports echo it to prove which content was reviewed. */
  @Column({ type: "varchar" })
  contentHash: string;
}
