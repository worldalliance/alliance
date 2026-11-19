import { KoraItemType } from "@alliance/common/kora";
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

/** One conversation to review, keyed by KORA's conversation_id. */
@Entity()
@Index(["batchId", "position"], { unique: true })
export class KoraConversation {
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

  @Index()
  @Column({ type: "varchar" })
  @ApiProperty()
  riskId: string;

  @Column({
    type: "enum",
    enum: KoraItemType,
    enumName: "KoraItemType",
  })
  @ApiProperty({ enum: KoraItemType, enumName: "KoraItemType" })
  itemType: KoraItemType;

  /** AI turns. Drives the session's load budget and the extended opt-in. */
  @Column({ type: "int" })
  @ApiProperty()
  nTurns: number;

  /** Behind the extended opt-in. From the import, defaulting to nTurns above the short length. */
  @Column({ type: "boolean" })
  @ApiProperty()
  optIn: boolean;

  /** The converted conversation, valid against conversationSchema when stored. */
  @Column({ type: "jsonb" })
  content: unknown;

  /** "sha256:<hex>" of JSON.stringify(content); exports echo it to prove which content was reviewed. */
  @Column({ type: "varchar" })
  contentHash: string;
}
