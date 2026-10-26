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
  IsNumber,
  IsOptional,
  IsString,
  Max,
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
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Action } from "./action.entity";

// A variant is either part of a random split (`splitValue`) or a branch routed
// by `rule`, never both; an action's live variants are all one kind.
@Entity()
@Check(
  "CHK_action_form_variant_split_xor_rule",
  `("splitValue" IS NULL) <> ("rule" IS NULL)`,
)
@Index("IDX_action_form_variant_actionId", ["actionId"])
@Index("IDX_action_form_variant_formId", ["formId"])
@Index("UQ_action_form_variant_formId", ["formId"], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class ActionFormVariant {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsInt()
  actionId: number;

  @ManyToOne(() => Action, { onDelete: "CASCADE" })
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

  @Column({ type: "double precision", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  splitValue: number | null;

  @Column({ type: "jsonb", nullable: true })
  @ApiProperty({ nullable: true })
  @IsOptional()
  @Type(() => Object)
  rule: unknown | null;

  /** Order among a rule-routed action's branches; the first match wins. */
  @Column({ type: "int", default: 0 })
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

export interface ParsedActionFormVariant extends ActionFormVariant {
  rule: CohortExpression | null;
}

export function parseActionFormVariant(
  variant: ActionFormVariant,
): ParsedActionFormVariant {
  variant.rule =
    variant.rule == null ? null : cohortExpressionSchema.parse(variant.rule);
  return variant as ParsedActionFormVariant;
}

export function isRuleRouted(
  variants: readonly Pick<ActionFormVariant, "rule">[],
): boolean {
  return variants.some((v) => v.rule != null);
}
