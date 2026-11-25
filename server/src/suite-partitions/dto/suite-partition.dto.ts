import { CellAssignment, PartWork } from "@alliance/common/suite-partition";
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
import type { PartitionProblem, PartitionWarning } from "../partition-check";
import { PartFallback } from "../partition-parts";
import type { PartitionPreview } from "../partition-preview";
import type {
  PartitionPreviewResult,
  PartitionSaveResult,
  PartitionView,
} from "../suite-partitions.service";

export class PartitionCellDto {
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

export class PartitionPartDraftDto {
  @ApiProperty() @Transform(toLowerCase) @IsUUID() id: string;

  @ApiProperty() @IsString() @MaxLength(200) name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The condition as text; null only for the last part, "Everyone else".',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20000)
  text: string | null;

  @ApiProperty({
    enum: PartFallback,
    enumName: "PartFallback",
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== null)
  @IsEnum(PartFallback)
  fallback: PartFallback | null;

  @ApiProperty() @IsBoolean() noRequiredWorkTick: boolean;

  @ApiProperty({ type: () => PartitionCellDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartitionCellDto)
  cells: PartitionCellDto[];
}

export class PartitionPartsDto {
  @ApiProperty({ type: () => PartitionPartDraftDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartitionPartDraftDto)
  parts: PartitionPartDraftDto[];
}

export class SavePartitionDto extends PartitionPartsDto {
  @ApiProperty({ description: "The partition version the admin edited." })
  @IsInt()
  baseVersionId: number;
}

export class PartitionPartDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) text: string | null;
  @ApiProperty({
    enum: PartFallback,
    enumName: "PartFallback",
    nullable: true,
  })
  fallback: PartFallback | null;
  @ApiProperty({
    enum: [PartWork.OptionalOnly, PartWork.Nothing],
    enumName: "PartWork",
    nullable: true,
    description:
      "The kind of work the part had when ticked as intentionally without required work.",
  })
  noRequiredWorkTick: PartWork | null;
  @ApiProperty({ type: () => PartitionCellDto, isArray: true })
  cells: PartitionCellDto[];

  constructor(input: PartitionView["parts"][number]) {
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

export class PartitionActionDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;

  constructor(input: ParsedAction) {
    this.id = input.id;
    this.name = input.name;
  }
}

export class SuitePartitionDto {
  @ApiProperty() versionId: number;
  @ApiProperty({ type: () => PartitionPartDto, isArray: true })
  parts: PartitionPartDto[];
  @ApiProperty({ type: () => PartitionActionDto, isArray: true })
  actions: PartitionActionDto[];
  @ApiProperty({ description: "Whether the partition has gone live." })
  launched: boolean;
  @ApiProperty({ type: Date, nullable: true }) launchFailedAt: Date | null;
  @ApiProperty({ type: String, nullable: true }) launchFailure: string | null;

  constructor(input: PartitionView) {
    this.versionId = input.versionId;
    this.parts = input.parts.map((part) => new PartitionPartDto(part));
    this.actions = input.actions.map(
      (action) => new PartitionActionDto(action),
    );
    this.launched = input.launched;
    this.launchFailedAt = input.launchFailedAt;
    this.launchFailure = input.launchFailure;
  }
}

export class PartitionProblemDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: "The part it is about.",
  })
  partId: string | null;
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

  constructor(input: PartitionProblem) {
    this.partId = input.partId;
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

export class PartitionWarningDto {
  @ApiProperty() partId: string;
  @ApiProperty() message: string;

  constructor(input: PartitionWarning) {
    this.partId = input.partId;
    this.message = input.message;
  }
}

export class SavePartitionResultDto {
  @ApiProperty({ type: () => PartitionProblemDto, isArray: true })
  problems: PartitionProblemDto[];
  @ApiProperty({ type: () => PartitionWarningDto, isArray: true })
  warnings: PartitionWarningDto[];
  @ApiProperty({
    type: () => SuitePartitionDto,
    nullable: true,
    description: "The partition as stored, unless the check refused the save.",
  })
  partition: SuitePartitionDto | null;

  constructor(input: PartitionSaveResult) {
    this.problems = input.problems.map((each) => new PartitionProblemDto(each));
    this.warnings = input.warnings.map((each) => new PartitionWarningDto(each));
    this.partition = input.partition && new SuitePartitionDto(input.partition);
  }
}

export class PartCountDto {
  @ApiProperty() partId: string;
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
  @ApiProperty({ description: "The part or formula it is in." }) where: string;
  @ApiProperty() text: string;
}

export class PartitionPreviewDto {
  @ApiProperty() population: number;
  @ApiProperty({ type: () => PartCountDto, isArray: true })
  parts: PartCountDto[];
  @ApiProperty({ type: () => WorkCountsDto }) byWork: WorkCountsDto;
  @ApiProperty() couldNotDecide: number;
  @ApiProperty({ type: () => PreviewErrorDto, isArray: true })
  errors: PreviewErrorDto[];
  @ApiProperty({ type: () => UntakenBranchDto, isArray: true })
  untakenBranches: UntakenBranchDto[];

  constructor(input: PartitionPreview) {
    this.population = input.population;
    this.parts = input.parts.map(({ partId, count }) => ({
      partId,
      count,
    }));
    this.byWork = {
      required: input.byWork[PartWork.Required],
      optionalOnly: input.byWork[PartWork.OptionalOnly],
      nothing: input.byWork[PartWork.Nothing],
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

export class PartitionPreviewResultDto {
  @ApiProperty({
    type: () => PartitionProblemDto,
    isArray: true,
    description:
      "Why the partition can't be previewed as it is; empty when `preview` is set.",
  })
  problems: PartitionProblemDto[];
  @ApiPropertyOptional({ type: () => PartitionPreviewDto })
  preview?: PartitionPreviewDto;

  constructor(input: PartitionPreviewResult) {
    this.problems = input.problems.map((each) => new PartitionProblemDto(each));
    if ("preview" in input)
      this.preview = new PartitionPreviewDto(input.preview);
  }
}
