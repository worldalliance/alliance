import { ApiProperty } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Video {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  key: string;

  @Column()
  @ApiProperty()
  originalFilename: string;

  @Column()
  @ApiProperty()
  mime: string;

  @Column()
  @ApiProperty()
  size: number;

  @Column({ default: "processing" })
  @ApiProperty()
  status: "processing" | "ready" | "failed";

  @Column({ type: "float", nullable: true })
  @ApiProperty({ nullable: true })
  duration: number | null;

  @Column({ type: "jsonb", nullable: true })
  @ApiProperty({ nullable: true })
  processingInfo: Record<string, unknown> | null;

  @CreateDateColumnTz()
  dateCreated: Date;

  @UpdateDateColumnTz()
  dateUpdated: Date;
}
