import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
} from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ActionCategory } from "../action-category";
import { Action } from "./action.entity";

/**
 * A series of actions run week after week toward one goal. Step order comes
 * from each action's `member_action` event date, not a stored position.
 */
@Entity()
export class Project {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ unique: true })
  @ApiProperty()
  @Allow()
  name: string;

  @Column({
    type: "enum",
    enum: ActionCategory,
    array: true,
    default: [],
  })
  @ApiProperty({
    enum: ActionCategory,
    enumName: "ActionCategory",
    isArray: true,
    description: "Alliance goals the project works towards, or meta",
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(ActionCategory, { each: true })
  category: ActionCategory[];

  @CreateDateColumnTz()
  @ApiProperty()
  @Type(() => Date)
  @Allow()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Type(() => Date)
  @Allow()
  updatedAt: Date;

  // Relations

  @OneToMany(() => Action, (action) => action.project)
  @ApiPropertyOptional({ type: () => Action, isArray: true })
  @Type(() => Action)
  @IsOptional()
  actions?: Relation<Action>[];
}
