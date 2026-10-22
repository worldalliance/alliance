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
import type { VariableAggregate } from "./variable-aggregates";

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

export type VariableAggregates = { aggregates: VariableAggregate[] };

export class VariableAggregatesDto {
  @ApiProperty({ type: () => VariableAggregateDto, isArray: true })
  aggregates: VariableAggregateDto[];

  constructor(input: VariableAggregates) {
    this.aggregates = input.aggregates.map(
      (aggregate) => new VariableAggregateDto(aggregate),
    );
  }
}
