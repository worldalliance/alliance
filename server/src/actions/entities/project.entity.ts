import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsOptional } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
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
