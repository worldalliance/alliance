import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
  validateSync,
} from "class-validator";
import { trim } from "src/utils/transforms";
import { VALIDATION_PIPE_OPTIONS } from "src/utils/validation-pipe-options";
import type { WaitlistCohort } from "../entities/waitlist-cohort.entity";
import {
  rejectUnknownFilterFields,
  WaitlistEntryFilterBodyDto,
  WaitlistEntryFilterDto,
} from "./waitlist-entry-admin.dto";

/** Throws when a stored filter no longer matches the filter the list takes. */
export function parseCohortFilter(raw: unknown): WaitlistEntryFilterDto {
  const filter = plainToInstance(WaitlistEntryFilterDto, raw);
  const errors = validateSync(filter, {
    ...VALIDATION_PIPE_OPTIONS,
    forbidNonWhitelisted: true,
  });
  if (!(filter instanceof WaitlistEntryFilterDto) || errors.length) {
    throw new Error(`Stored waitlist cohort filter is invalid: ${errors}`);
  }
  return filter;
}

export type ParsedWaitlistCohort = {
  cohort: WaitlistCohort;
  filter: WaitlistEntryFilterDto;
};

export class WaitlistCohortDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: () => WaitlistEntryFilterDto })
  filter: WaitlistEntryFilterDto;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  constructor(input: ParsedWaitlistCohort) {
    this.id = input.cohort.id;
    this.name = input.cohort.name;
    this.filter = input.filter;
    this.updatedAt = input.cohort.updatedAt;
  }
}

export class CreateWaitlistCohortDto extends WaitlistEntryFilterBodyDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class UpdateWaitlistCohortDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ type: () => WaitlistEntryFilterDto })
  @Transform(rejectUnknownFilterFields)
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => WaitlistEntryFilterDto)
  filter?: WaitlistEntryFilterDto;
}
