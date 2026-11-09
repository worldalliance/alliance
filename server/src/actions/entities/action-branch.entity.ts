import {
  type CohortExpression,
  cohortExpressionSchema,
} from "@alliance/common/cohort-expression";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  Allow,
  IsEmpty,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Form } from "src/tasks/entities/form.entity";
import type { Relation } from "src/utils/Repository";
import { trimToNull } from "src/utils/transforms";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Action } from "./action.entity";

@Entity()
@Index("IDX_action_branch_actionId", ["actionId"])
@Index("UQ_action_branch_formId", ["formId"], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class ActionBranch {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsInt()
  actionId: number;

  @ManyToOne(() => Action, (action) => action.branches, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "actionId" })
  @Type(() => Action)
  @IsOptional()
  action?: Relation<Action>;

  @Column()
  @ApiProperty()
  @IsInt()
  formId: number;

  @ManyToOne(() => Form, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "formId" })
  @Type(() => Form)
  @IsOptional()
  form?: Relation<Form>;

  @Column({ type: "text" })
  @ApiProperty()
  @IsString()
  name: string;

  @Column({ type: "jsonb" })
  @ApiProperty({ type: Object })
  @IsOptional()
  @Type(() => Object)
  rule: unknown;

  /** Routing order: a member gets the first branch whose rule they match. */
  @Column({ type: "int" })
  @ApiProperty()
  @IsInt()
  position: number;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  nameOverride: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  shortDescriptionOverride: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  bodyOverride: string | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeEstimateOverride: number | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  imageOverride: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  squareThumbnailImageOverride: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  squareThumbnailImageAltOverride: string | null;

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

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;
}

export interface ParsedActionBranch extends ActionBranch {
  rule: CohortExpression;
}

export function parseActionBranch(branch: ActionBranch): ParsedActionBranch {
  return Object.assign(branch, {
    rule: cohortExpressionSchema.parse(branch.rule),
  });
}

export function loadedActionBranches<
  T extends { id: number; branches?: readonly unknown[] },
>(action: T): NonNullable<T["branches"]> {
  if (!action.branches) {
    throw new Error(`branches of action ${action.id} not loaded`);
  }
  return action.branches;
}
