import {
  SaveProblemKind,
  type SaveProblem,
} from "@alliance/common/expression/named";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { toLowerCase, trimToNull } from "src/utils/transforms";
import type { FormulaVersion } from "../entities/formula-version.entity";
import type { CurrentFormula } from "../formula-store";

/** A formula's current version printed as text. */
export type FormulaDtoArgs = CurrentFormula & {
  text: string;
  /** Ids of the formulas it reads directly. */
  reads: string[];
};

export type FormulaVersionDtoArgs = {
  version: FormulaVersion;
  text: string;
  savedByName: string | null;
};

export class FormulaDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: "The current version, printed." })
  text: string;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ description: "The current version's id." })
  versionId: number;
  @ApiProperty({
    type: String,
    isArray: true,
    description: "Ids of the formulas it reads.",
  })
  reads: string[];
  @ApiProperty({ type: Date }) updatedAt: Date;

  constructor(input: FormulaDtoArgs) {
    this.id = input.formula.id;
    this.name = input.formula.name;
    this.text = input.text;
    this.notes = input.version.notes;
    this.versionId = input.version.id;
    this.reads = input.reads;
    this.updatedAt = input.version.createdAt;
  }
}

export class FormulaVersionDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() text: string;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ type: String, nullable: true }) savedByName: string | null;
  @ApiProperty({ type: Date }) createdAt: Date;

  constructor(input: FormulaVersionDtoArgs) {
    this.id = input.version.id;
    this.name = input.version.name;
    this.text = input.text;
    this.notes = input.version.notes;
    this.savedByName = input.savedByName;
    this.createdAt = input.version.createdAt;
  }
}

export class FormulaEditDto {
  @ApiProperty() @Transform(toLowerCase) @IsUUID() id: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "The version edited; null for a new formula.",
  })
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  baseVersionId: number | null;

  @ApiProperty() @IsString() @MaxLength(100) name: string;

  @ApiProperty({
    description:
      "Names in it mean the formulas that have them once this save is applied.",
  })
  @IsString()
  @MaxLength(20000)
  text: string;

  @ApiProperty({ type: String, nullable: true })
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  @Matches(/^[^\0]*$/, {
    message: "Notes have a character that can't be stored.",
  })
  notes: string | null;
}

export class FormulaDeletionDto {
  @ApiProperty() @Transform(toLowerCase) @IsUUID() id: string;
  @ApiProperty() @IsInt() baseVersionId: number;
}

export class ListDeletionDto {
  @ApiProperty() @Transform(toLowerCase) @IsUUID() id: string;
  @ApiProperty({ description: "The membership version the admin saw." })
  @IsInt()
  baseVersionId: number;
}

export class SaveFormulasDto {
  @ApiProperty({ type: () => FormulaEditDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaEditDto)
  edits: FormulaEditDto[];

  @ApiProperty({ type: () => FormulaDeletionDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaDeletionDto)
  deletions: FormulaDeletionDto[];

  @ApiPropertyOptional({
    type: () => ListDeletionDto,
    isArray: true,
    description:
      "Member lists to delete; refused, like a formula deletion, while a formula reads one.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListDeletionDto)
  deletedLists?: ListDeletionDto[];
}

export class FormulaDiagnosticDto {
  @ApiProperty() message: string;
  @ApiProperty({ description: "Offset into the problem's text." })
  start: number;
  @ApiProperty() end: number;
}

export class FormulaProblemDto {
  @ApiProperty({ enum: SaveProblemKind, enumName: "SaveProblemKind" })
  kind: SaveProblemKind;

  @ApiProperty({ description: "The formula's id, or the dependent's." })
  id: string;

  @ApiPropertyOptional({ description: "Set for a name problem." })
  message?: string;

  @ApiPropertyOptional({
    description: "The text `diagnostics` are located in.",
  })
  text?: string;

  @ApiPropertyOptional({ type: () => FormulaDiagnosticDto, isArray: true })
  diagnostics?: FormulaDiagnosticDto[];

  constructor(input: SaveProblem) {
    this.kind = input.kind;
    this.id = input.id;
    switch (input.kind) {
      case SaveProblemKind.Name:
        this.message = input.message;
        break;
      case SaveProblemKind.Named:
      case SaveProblemKind.Dependent:
        this.text = input.text;
        this.diagnostics = input.diagnostics.map(({ message, start, end }) => ({
          message,
          start,
          end,
        }));
        break;
      default:
        throw new Error(`unknown problem kind: ${input satisfies never}`);
    }
  }
}

export type SaveFormulasResult = { problems: SaveProblem[] };

export class SaveFormulasResultDto {
  @ApiProperty({
    type: () => FormulaProblemDto,
    isArray: true,
    description: "Why the save was refused; empty when it was saved.",
  })
  problems: FormulaProblemDto[];

  constructor(input: SaveFormulasResult) {
    this.problems = input.problems.map(
      (problem) => new FormulaProblemDto(problem),
    );
  }
}
