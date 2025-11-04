import { ApiProperty, PickType } from '@nestjs/swagger';

import { UserAwayRange } from '../entities/user-away-range.entity';
import { IsDefined, IsString } from 'class-validator';

export class CreateAwayRangeDto extends PickType(UserAwayRange, ['note']) {
  @ApiProperty()
  @IsDefined()
  @IsString()
  startDay: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  endDay: string;
}

export class UserAwayRangeDto extends PickType(UserAwayRange, [
  'id',
  'startDate',
  'endDate',
  'note',
  'createdAt',
]) {}
