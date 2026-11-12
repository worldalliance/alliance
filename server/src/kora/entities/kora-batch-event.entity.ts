import { KoraBatchEventKind } from "@alliance/common/kora";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * An admin's action on a batch, or a completed assignment on staging. Batch and
 * assignment are plain columns, not foreign keys, so an event outlives what it
 * names.
 */
@Entity()
export class KoraBatchEvent {
  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  id: string;

  @Column({
    type: "enum",
    enum: KoraBatchEventKind,
    enumName: "KoraBatchEventKind",
  })
  @ApiProperty({ enum: KoraBatchEventKind, enumName: "KoraBatchEventKind" })
  kind: KoraBatchEventKind;

  @Column({ type: "uuid", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  batchId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  batchUploadedAt: Date | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  transcriptCount: number | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  ratingCount: number | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  assignmentCount: number | null;

  @Column({ type: "uuid", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  assignmentId: string | null;

  @Column({ type: "uuid", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  reviewerId: string | null;

  @Column({ type: "int", nullable: true })
  adminId: number | null;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "adminId" })
  admin?: Relation<User>;

  /** The admin's name when they acted, kept after their account is deleted. */
  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  adminName: string | null;

  @Index()
  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;
}
