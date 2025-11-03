import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserAwayRange } from '../entities/user-away-range.entity';

export class CreateAwayRangeDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UserAwayRangeDto extends PickType(UserAwayRange, [
  'id',
  'startDate',
  'endDate',
  'note',
  'createdAt',
]) {}
