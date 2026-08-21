import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsInt, Min } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
@Index(["ambassador", "startAt", "dueAt"])
export class AmbassadorInviteGoal {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  @IsInt()
  @Min(1)
  targetSuccessfulRecruits: number;

  @Column({ type: "timestamptz" })
  @ApiProperty({ type: Date })
  @Type(() => Date)
  @Allow()
  startAt: Date;

  @Column({ type: "timestamptz" })
  @ApiProperty({ type: Date })
  @Type(() => Date)
  @Allow()
  dueAt: Date;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  @Allow()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  @Allow()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @ApiProperty({ type: () => User })
  @Type(() => User)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  ambassador: Relation<User>;
}
