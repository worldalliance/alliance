import { ApiProperty } from "@nestjs/swagger";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/** One upload of KORA transcripts. */
@Entity()
export class KoraBatch {
  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  id: string;

  @Column({ type: "int" })
  @ApiProperty()
  transcriptsPerAssignment: number;

  @Column({ type: "int" })
  @ApiProperty()
  reviewsPerTranscript: number;

  /** Set while retired: its transcripts are left out of new assignments. */
  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  retiredAt: Date | null;

  /**
   * After it, its transcripts are left out of new assignments and assignments
   * holding them close. BACKCOMPAT(kora-batch-closes-at): null on batches
   * uploaded before closing dates, read as never closing; make it required
   * once every batch has one.
   */
  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  closesAt: Date | null;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;
}
