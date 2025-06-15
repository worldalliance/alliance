import { PrefillUser } from './prefill-user.entity';
import { PickType } from '@nestjs/swagger';

export class PrefillUserDto extends PickType(PrefillUser, [
  'email',
  'firstName',
  'lastName',
  'phone',
  'city',
]) {}
