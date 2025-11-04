import { PickType } from '@nestjs/swagger';

import { UserAwayRange } from '../entities/user-away-range.entity';

export class CreateAwayRangeDto extends PickType(UserAwayRange, [
  'startDate',
  'endDate',
  'note',
]) {}

export class UserAwayRangeDto extends PickType(UserAwayRange, [
  'id',
  'startDate',
  'endDate',
  'note',
  'createdAt',
]) {}
