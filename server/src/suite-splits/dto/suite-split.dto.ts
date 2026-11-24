import { CellAssignment, GroupWork } from "@alliance/common/suite-split";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import type { ParsedAction } from "src/actions/entities/action.entity";
import { FormulaDiagnosticDto } from "src/formulas/dto/formula.dto";
import { toLowerCase } from "src/utils/transforms";
import type { SplitProblem, SplitWarning } from "../split-check";
import { GroupFallback } from "../split-groups";
import type { SplitPreview } from "../split-preview";
import type {
  SplitPreviewResult,
  SplitSaveResult,
  SplitView,
} from "../suite-splits.service";

export class SplitCellDto {
  @ApiProperty() @IsInt() actionId: number;

  @ApiProperty({
    enum: [CellAssignment.Required, CellAssignment.Optional],
    enumName: "CellAssignment",
    description: "An action not listed is not assigned.",
  })
  @IsEnum(CellAssignment)
  @IsIn([CellAssignment.Required, CellAssignment.Optional])
  assignment: CellAssignment.Required | CellAssignment.Optional;
}

export class SplitGroupDraftDto {
  @ApiProperty() @Transform(toLowerCase) @IsUUID() id: string;

  @ApiProperty() @IsString() @MaxLength(200) name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The condition as text; null only for the last group, "Everyone else".',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20000)
  text: string | null;

  @ApiProperty({
    enum: GroupFallback,
    enumName: "GroupFallback",
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== null)
  @IsEnum(GroupFallback)
  fallback: GroupFallback | null;

  @ApiProperty() @IsBoolean() noRequiredWorkTick: boolean;

  @ApiProperty({ type: () => SplitCellDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitCellDto)
  cells: SplitCellDto[];
}

export class SplitGroupsDto {
  @ApiProperty({ type: () => SplitGroupDraftDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitGroupDraftDto)
  groups: SplitGroupDraftDto[];
}

export class SaveSplitDto extends SplitGroupsDto {
  @ApiProperty({ description: "The split version the admin edited." })
  @IsInt()
  baseVersionId: number;
}

export class SplitGroupDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) text: string | null;
  @ApiProperty({
    enum: GroupFallback,
    enumName: "GroupFallback",
    nullable: true,
  })
  fallback: GroupFallback | null;
  @ApiProperty({
    enum: [GroupWork.OptionalOnly, GroupWork.Nothing],
    enumName: "GroupWork",
    nullable: true,
    description:
      "The kind of work the group had when ticked as intentionally without required work.",
  })
  noRequiredWorkTick: GroupWork | null;
  @ApiProperty({ type: () => SplitCellDto, isArray: true })
  cells: SplitCellDto[];

  constructor(input: SplitView["groups"][number]) {
    this.id = input.id;
    this.name = input.name;
    this.text = input.text;
    this.fallback = input.fallback;
    this.noRequiredWorkTick = input.noRequiredWorkTick;
    this.cells = input.cells.map(({ actionId, assignment }) => ({
      actionId,
      assignment,
    }));
  }
}

export class SplitActionDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;

  constructor(input: ParsedAction) {
    this.id = input.id;
    this.name = input.name;
  }
}

export class SuiteSplitDto {
  @ApiProperty() versionId: number;
  @ApiProperty({ type: () => SplitGroupDto, isArray: true })
  groups: SplitGroupDto[];
  @ApiProperty({ type: () => SplitActionDto, isArray: true })
  actions: SplitActionDto[];
  @ApiProperty({ description: "Whether the split has gone live." })
  launched: boolean;
  @ApiProperty({ type: Date, nullable: true }) launchFailedAt: Date | null;
  @ApiProperty({ type: String, nullable: true }) launchFailure: string | null;

  constructor(input: SplitView) {
    this.versionId = input.versionId;
    this.groups = input.groups.map((group) => new SplitGroupDto(group));
    this.actions = input.actions.map((action) => new SplitActionDto(action));
    this.launched = input.launched;
    this.launchFailedAt = input.launchFailedAt;
    this.launchFailure = input.launchFailure;
  }
}

export class SplitProblemDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: "The group it is about.",
  })
  groupId: string | null;
  @ApiPropertyOptional({
    description: "Set for a problem with no place in the text.",
  })
  message?: string;
  @ApiPropertyOptional({
    description: "The text `diagnostics` are located in.",
  })
  text?: string;
  @ApiPropertyOptional({ type: () => FormulaDiagnosticDto, isArray: true })
  diagnostics?: FormulaDiagnosticDto[];

  constructor(input: SplitProblem) {
    this.groupId = input.groupId;
    if ("message" in input) {
      this.message = input.message;
    } else {
      this.text = input.text;
      this.diagnostics = input.diagnostics.map(({ message, start, end }) => ({
        message,
        start,
        end,
      }));
    }
  }
}

export class SplitWarningDto {
  @ApiProperty() groupId: string;
  @ApiProperty() message: string;

  constructor(input: SplitWarning) {
    this.groupId = input.groupId;
    this.message = input.message;
  }
}

export class SaveSplitResultDto {
  @ApiProperty({ type: () => SplitProblemDto, isArray: true })
  problems: SplitProblemDto[];
  @ApiProperty({ type: () => SplitWarningDto, isArray: true })
  warnings: SplitWarningDto[];
  @ApiProperty({
    type: () => SuiteSplitDto,
    nullable: true,
    description: "The split as stored, unless the check refused the save.",
  })
  split: SuiteSplitDto | null;

  constructor(input: SplitSaveResult) {
    this.problems = input.problems.map((each) => new SplitProblemDto(each));
    this.warnings = input.warnings.map((each) => new SplitWarningDto(each));
    this.split = input.split && new SuiteSplitDto(input.split);
  }
}

export class GroupCountDto {
  @ApiProperty() groupId: string;
  @ApiProperty() count: number;
}

export class WorkCountsDto {
  @ApiProperty() required: number;
  @ApiProperty() optionalOnly: number;
  @ApiProperty() nothing: number;
}

export class PreviewErrorDto {
  @ApiProperty() message: string;
  @ApiProperty() count: number;
}

export class UntakenBranchDto {
  @ApiProperty({ description: "The group or formula it is in." }) where: string;
  @ApiProperty() text: string;
}

export class SplitPreviewDto {
  @ApiProperty() population: number;
  @ApiProperty({ type: () => GroupCountDto, isArray: true })
  groups: GroupCountDto[];
  @ApiProperty({ type: () => WorkCountsDto }) byWork: WorkCountsDto;
  @ApiProperty() couldNotDecide: number;
  @ApiProperty({ type: () => PreviewErrorDto, isArray: true })
  errors: PreviewErrorDto[];
  @ApiProperty({ type: () => UntakenBranchDto, isArray: true })
  untakenBranches: UntakenBranchDto[];

  constructor(input: SplitPreview) {
    this.population = input.population;
    this.groups = input.groups.map(({ groupId, count }) => ({
      groupId,
      count,
    }));
    this.byWork = {
      required: input.byWork[GroupWork.Required],
      optionalOnly: input.byWork[GroupWork.OptionalOnly],
      nothing: input.byWork[GroupWork.Nothing],
    };
    this.couldNotDecide = input.couldNotDecide;
    this.errors = input.errors.map(({ message, count }) => ({
      message,
      count,
    }));
    this.untakenBranches = input.untakenBranches.map(({ where, text }) => ({
      where,
      text,
    }));
  }
}

export class SplitPreviewResultDto {
  @ApiProperty({
    type: () => SplitProblemDto,
    isArray: true,
    description:
      "Why the groups can't be previewed as they are; empty when `preview` is set.",
  })
  problems: SplitProblemDto[];
  @ApiPropertyOptional({ type: () => SplitPreviewDto })
  preview?: SplitPreviewDto;

  constructor(input: SplitPreviewResult) {
    this.problems = input.problems.map((each) => new SplitProblemDto(each));
    if ("preview" in input) this.preview = new SplitPreviewDto(input.preview);
  }
}
