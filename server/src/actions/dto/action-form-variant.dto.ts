import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import type { RerouteMove } from "../action-form-routing.service";
import { VariantStats } from "../action-form-variant.service";
import { ActionFormAssignment } from "../entities/action-form-assignment.entity";
import { ActionFormVariant } from "../entities/action-form-variant.entity";

const COPY_OVERRIDE_FIELDS = [
  "nameOverride",
  "shortDescriptionOverride",
  "bodyOverride",
  "timeEstimateOverride",
  "imageOverride",
  "squareThumbnailImageOverride",
  "squareThumbnailImageAltOverride",
] as const;

const OPTIONALITY_FIELDS = ["optional", "optionalReason"] as const;

class VariantSettingsDto extends PartialType(
  PickType(ActionFormVariant, [...COPY_OVERRIDE_FIELDS, ...OPTIONALITY_FIELDS]),
) {}

export class ActionFormVariantDto extends PickType(ActionFormVariant, [
  "id",
  "actionId",
  "formId",
  "name",
  "splitValue",
  "rule",
  "position",
  ...COPY_OVERRIDE_FIELDS,
  ...OPTIONALITY_FIELDS,
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
    this.rule = variant.rule;
    this.position = variant.position;
    this.nameOverride = variant.nameOverride;
    this.shortDescriptionOverride = variant.shortDescriptionOverride;
    this.bodyOverride = variant.bodyOverride;
    this.timeEstimateOverride = variant.timeEstimateOverride;
    this.imageOverride = variant.imageOverride;
    this.squareThumbnailImageOverride = variant.squareThumbnailImageOverride;
    this.squareThumbnailImageAltOverride =
      variant.squareThumbnailImageAltOverride;
    this.optional = variant.optional;
    this.optionalReason = variant.optionalReason;
    this.createdAt = variant.createdAt;
    this.updatedAt = variant.updatedAt;
  }
}

export class CreateActionFormVariantDto extends VariantSettingsDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      "Fraction of new joiners (0-1), for a random split. Set either this or rule.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  splitValue?: number | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      "Cohort expression routing members to this branch. Set either this or splitValue.",
  })
  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description:
      "Form to clone for this variant. Defaults to the action's current taskFormId.",
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  sourceFormId?: number | null;
}

export class UpdateActionFormVariantDto extends VariantSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown>;

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

export class PreviewBranchRoutingDto {
  @ApiProperty({
    type: Object,
    isArray: true,
    description: "Branch rules in routing order.",
  })
  @IsArray()
  @IsObject({ each: true })
  rules: Record<string, unknown>[];
}

export class BranchRoutingPreviewItemDto {
  @ApiProperty({ type: Number, isArray: true })
  userIds: number[];

  constructor(userIds: number[]) {
    this.userIds = userIds;
  }
}

export class BranchRoutingPreviewDto {
  @ApiProperty({
    type: () => BranchRoutingPreviewItemDto,
    isArray: true,
    description: "The members each rule would get, in the order sent.",
  })
  branches: BranchRoutingPreviewItemDto[];

  constructor(branches: number[][]) {
    this.branches = branches.map((ids) => new BranchRoutingPreviewItemDto(ids));
  }
}

export class ReorderActionBranchesDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  variantIds: number[];
}

export class MoveActionFormMemberDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsInt()
  variantId: number;

  @ApiProperty()
  @IsBoolean()
  notify: boolean;
}

export class RerouteActionBranchesDto {
  @ApiProperty()
  @IsBoolean()
  notify: boolean;
}

export class RerouteMoveDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  fromVariantId: number;

  @ApiProperty()
  toVariantId: number;

  constructor(input: RerouteMove) {
    this.userId = input.userId;
    this.fromVariantId = input.fromVariantId;
    this.toVariantId = input.toVariantId;
  }
}

export class RerouteMovesDto {
  @ApiProperty({ type: () => RerouteMoveDto, isArray: true })
  moves: RerouteMoveDto[];

  constructor(moves: RerouteMove[]) {
    this.moves = moves.map((move) => new RerouteMoveDto(move));
  }
}

export class ActionFormAssignmentDto extends PickType(ActionFormAssignment, [
  "userId",
  "variantId",
  "assignedAt",
  "overriddenAt",
]) {
  @ApiProperty()
  userName: string;

  @ApiProperty({ type: String, nullable: true })
  overriddenByName: string | null;

  constructor(input: ActionFormAssignment) {
    super();
    if (!input.user) {
      throw new Error("ActionFormAssignmentDto requires user");
    }
    this.userId = input.userId;
    this.userName = input.user.name;
    this.variantId = input.variantId;
    this.assignedAt = input.assignedAt;
    this.overriddenAt = input.overriddenAt;
    this.overriddenByName = input.overriddenBy?.name ?? null;
  }
}
