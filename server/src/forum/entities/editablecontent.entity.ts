import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsDefined, IsString } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class EditableContent {
  @PrimaryGeneratedColumn()
  @Allow()
  id: number;

  @Column("text")
  @ApiProperty({ description: "Markdown or plain text body" })
  @IsString()
  body: string;

  @Column({ type: "jsonb", default: [] })
  @ApiProperty({
    type: String,
    isArray: true,
    description: "Image keys attached to the content",
  })
  @IsDefined()
  attachments: string[];

  @CreateDateColumnTz()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;
}
