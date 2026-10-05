import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsOptional, IsString, ValidateIf } from "class-validator";
import { GeneralUpdate } from "src/actions/entities/general-update.entity";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
@Unique(["name"])
export class Tag {
  // Fields

  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  @Allow()
  id: string;

  @Column()
  @ApiProperty()
  @Allow()
  name: string;

  @Column()
  @ApiProperty()
  @Allow()
  description: string;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  publicDisplayName: string | null;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  // Relations

  @ManyToMany(() => User, (user) => user.tags, {
    onDelete: "CASCADE",
  })
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @IsOptional()
  @JoinTable()
  @Type(() => User)
  users?: Relation<User>[];

  @ManyToMany(() => GeneralUpdate, (generalUpdate) => generalUpdate.tags)
  @ApiPropertyOptional({ type: () => GeneralUpdate, isArray: true })
  @IsOptional()
  @Type(() => GeneralUpdate)
  generalUpdates?: Relation<GeneralUpdate>[];
}

export function loadedTagUsers(tag: Tag): Relation<User>[] {
  if (!tag.users) throw new Error(`users of tag ${tag.id} not loaded`);
  return tag.users;
}
