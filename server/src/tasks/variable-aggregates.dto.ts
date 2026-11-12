import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsPositive,
  IsString,
  ValidateNested,
} from "class-validator";
import type {
  VariableAggregate,
  VariableAnsweredCount,
} from "./variable-aggregates";

const MAX_AGGREGATE_SOURCES = 100;

export class VariableAggregateSourceDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  sourceFormId: number;

  @ApiProperty()
  @IsString()
  fieldId: string;
}

export class CountVariableAggregatesDto {
  @ApiProperty({ type: () => VariableAggregateSourceDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(MAX_AGGREGATE_SOURCES)
  @ValidateNested({ each: true })
  @Type(() => VariableAggregateSourceDto)
  sources: VariableAggregateSourceDto[];

  /** Questions to count the members who answered. */
  @ApiProperty({ type: () => VariableAggregateSourceDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(MAX_AGGREGATE_SOURCES)
  @ValidateNested({ each: true })
  @Type(() => VariableAggregateSourceDto)
  answeredSources: VariableAggregateSourceDto[];
}

export class VariableAggregateDto {
  @ApiProperty()
  sourceFormId: number;

  @ApiProperty()
  fieldId: string;

  /**
   * Members counted under each option value. `null` when the form is gone or
   * no longer has that multiselect.
   */
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "number" },
    nullable: true,
  })
  counts: Record<string, number> | null;

  constructor(input: VariableAggregate) {
    this.sourceFormId = input.sourceFormId;
    this.fieldId = input.fieldId;
    this.counts = input.counts;
  }
}

export class VariableAnsweredCountDto {
  @ApiProperty()
  sourceFormId: number;

  @ApiProperty()
  fieldId: string;

  /**
   * Members whose latest submission answered the question. `null` when the
   * form is gone or no longer has that question.
   */
  @ApiProperty({ type: "number", nullable: true })
  count: number | null;

  constructor(input: VariableAnsweredCount) {
    this.sourceFormId = input.sourceFormId;
    this.fieldId = input.fieldId;
    this.count = input.count;
  }
}

export type VariableAggregates = {
  aggregates: VariableAggregate[];
  answered: VariableAnsweredCount[];
};

export class VariableAggregatesDto {
  @ApiProperty({ type: () => VariableAggregateDto, isArray: true })
  aggregates: VariableAggregateDto[];

  @ApiProperty({ type: () => VariableAnsweredCountDto, isArray: true })
  answered: VariableAnsweredCountDto[];

  constructor(input: VariableAggregates) {
    this.aggregates = input.aggregates.map(
      (aggregate) => new VariableAggregateDto(aggregate),
    );
    this.answered = input.answered.map(
      (answered) => new VariableAnsweredCountDto(answered),
    );
  }
}
