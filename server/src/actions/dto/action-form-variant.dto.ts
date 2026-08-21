import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { VariantStats } from "../action-form-variant.service";
import { ActionFormVariant } from "../entities/action-form-variant.entity";

export class ActionFormVariantDto extends PickType(ActionFormVariant, [
  "id",
  "actionId",
  "formId",
  "name",
  "splitValue",
  "createdAt",
  "updatedAt",
]) {
  constructor(variant: ActionFormVariant) {
    super();
    this.id = variant.id;
    this.actionId = variant.actionId;
    this.formId = variant.formId;
    this.name = variant.name;
    this.splitValue = variant.splitValue;
    this.createdAt = variant.createdAt;
    this.updatedAt = variant.updatedAt;
  }
}

export class CreateActionFormVariantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: "Fraction of new joiners (0-1)." })
  @IsNumber()
  @Min(0)
  @Max(1)
  splitValue: number;

  @ApiPropertyOptional({
    description:
      "Form to clone for this variant. Defaults to the action's current taskFormId.",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  sourceFormId?: number | null;
}

export class UpdateActionFormVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Fraction of new joiners (0-1)." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  splitValue?: number;
}

export class ActionFormVariantStatsDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    description: "null = the action's default form (taskFormId)",
  })
  variantId: number | null;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: Number, nullable: true })
  formId: number | null;

  @ApiProperty({ type: Number, nullable: true })
  splitValue: number | null;

  @ApiProperty()
  assigned: number;

  @ApiProperty()
  submitted: number;

  constructor(stats: VariantStats) {
    this.variantId = stats.variantId;
    this.name = stats.name;
    this.formId = stats.formId;
    this.splitValue = stats.splitValue;
    this.assigned = stats.assigned;
    this.submitted = stats.submitted;
  }
}

export class ActionFormVariantsListDto {
  @ApiProperty({ type: () => ActionFormVariantDto, isArray: true })
  @Type(() => ActionFormVariantDto)
  variants: ActionFormVariantDto[];

  @ApiProperty({ type: () => ActionFormVariantStatsDto, isArray: true })
  @Type(() => ActionFormVariantStatsDto)
  stats: ActionFormVariantStatsDto[];

  constructor(variants: ActionFormVariant[], stats: VariantStats[]) {
    this.variants = variants.map((v) => new ActionFormVariantDto(v));
    this.stats = stats.map((s) => new ActionFormVariantStatsDto(s));
  }
}
