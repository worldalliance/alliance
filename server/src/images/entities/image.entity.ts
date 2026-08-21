import { ApiProperty } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Image {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  key: string;

  @Column()
  @ApiProperty()
  mime: string;

  @Column()
  @ApiProperty()
  size: number;

  @CreateDateColumnTz()
  dateCreated: Date;

  @UpdateDateColumnTz()
  dateUpdated: Date;
}
