import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';

import {
  UserAwayRange,
  UserAwayRangeReason,
} from '../entities/user-away-range.entity';
import { IsDefined, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAwayRangeDto extends PickType(UserAwayRange, [
  'note',
  'reason',
]) {
  @ApiProperty()
  @IsDefined()
  @IsString()
  startDay: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  endDay: string;
}

export class UpdateAwayRangeDto extends PickType(UserAwayRange, [
  'note',
  'reason',
]) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDay?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDay?: string;
}

export class UserAwayRangeDto extends PickType(UserAwayRange, [
  'id',
  'startDate',
  'endDate',
  'reason',
  'note',
  'createdAt',
]) {}
