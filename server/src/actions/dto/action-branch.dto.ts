import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import type { BranchStats } from "../action-branch-admin.service";
import type { RerouteMove } from "../action-form-routing.service";
import { ActionBranch } from "../entities/action-branch.entity";
import { ActionFormAssignment } from "../entities/action-form-assignment.entity";

const COPY_OVERRIDE_FIELDS = [
  "nameOverride",
  "shortDescriptionOverride",
  "bodyOverride",
  "timeEstimateOverride",
  "imageOverride",
  "squareThumbnailImageOverride",
  "squareThumbnailImageAltOverride",
] as const;

class BranchCopyOverridesDto extends PartialType(
  PickType(ActionBranch, COPY_OVERRIDE_FIELDS),
) {}

export class ActionBranchDto extends PickType(ActionBranch, [
  "id",
  "actionId",
  "formId",
  "name",
  "rule",
  "position",
  ...COPY_OVERRIDE_FIELDS,
  "createdAt",
  "updatedAt",
]) {
  constructor(input: ActionBranch) {
    super();
    this.id = input.id;
    this.actionId = input.actionId;
    this.formId = input.formId;
    this.name = input.name;
    this.rule = input.rule;
    this.position = input.position;
    this.nameOverride = input.nameOverride;
    this.shortDescriptionOverride = input.shortDescriptionOverride;
    this.bodyOverride = input.bodyOverride;
    this.timeEstimateOverride = input.timeEstimateOverride;
    this.imageOverride = input.imageOverride;
    this.squareThumbnailImageOverride = input.squareThumbnailImageOverride;
    this.squareThumbnailImageAltOverride =
      input.squareThumbnailImageAltOverride;
    this.createdAt = input.createdAt;
    this.updatedAt = input.updatedAt;
  }
}

export class ActionBranchStatsDto {
  @ApiProperty()
  branchId: number;

  @ApiProperty()
  assigned: number;

  @ApiProperty()
  submitted: number;

  constructor(input: BranchStats) {
    this.branchId = input.branchId;
    this.assigned = input.assigned;
    this.submitted = input.submitted;
  }
}

export type ActionBranchesList = {
  branches: ActionBranch[];
  stats: BranchStats[];
};

export class ActionBranchesListDto {
  @ApiProperty({ type: () => ActionBranchDto, isArray: true })
  branches: ActionBranchDto[];

  @ApiProperty({ type: () => ActionBranchStatsDto, isArray: true })
  stats: ActionBranchStatsDto[];

  constructor(input: ActionBranchesList) {
    this.branches = input.branches.map((b) => new ActionBranchDto(b));
    this.stats = input.stats.map((s) => new ActionBranchStatsDto(s));
  }
}

export class CreateActionBranchDto extends BranchCopyOverridesDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({
    type: Object,
    description:
      "Cohort expression routing members to this branch; the first matching branch wins.",
  })
  @IsObject()
  rule: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      "Form to clone for this branch. Defaults to the action's task form.",
  })
  @IsOptional()
  @IsInt()
  sourceFormId?: number | null;
}

export class UpdateActionBranchDto extends BranchCopyOverridesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown>;
}

export class ReorderActionBranchesDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  branchIds: number[];
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

export class MoveToBranchDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsInt()
  branchId: number;

  @ApiProperty()
  @IsBoolean()
  notify: boolean;
}

export class MoveToVariantDto {
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
  fromBranchId: number;

  @ApiProperty()
  toBranchId: number;

  constructor(input: RerouteMove) {
    this.userId = input.userId;
    this.fromBranchId = input.fromBranchId;
    this.toBranchId = input.toBranchId;
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
  "branchId",
  "assignedAt",
  "overriddenAt",
]) {
  @ApiProperty()
  @IsDefined()
  userName: string;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  overriddenByName: string | null;

  constructor(input: ActionFormAssignment) {
    super();
    if (!input.user) {
      throw new Error("ActionFormAssignmentDto requires user");
    }
    this.userId = input.userId;
    this.userName = input.user.name;
    this.variantId = input.variantId;
    this.branchId = input.branchId;
    this.assignedAt = input.assignedAt;
    this.overriddenAt = input.overriddenAt;
    this.overriddenByName = input.overriddenBy?.name ?? null;
  }
}
