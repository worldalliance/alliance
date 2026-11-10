import { ApiProperty } from "@nestjs/swagger";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/** One upload of KORA transcripts, with the export schema their reviews are checked against. */
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

  /** A JSON Schema object, checked to compile and to accept the review tool's sample export on upload. */
  @Column({ type: "jsonb" })
  exportSchema: unknown;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;
}
