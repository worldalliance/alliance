import { PickType } from '@nestjs/swagger';
import { PaymentUserDataToken } from '../entities/payment-token.entity';

export class CreatePartialProfileDto extends PickType(PaymentUserDataToken, [
  'email',
  'firstName',
  'lastName',
  'id',
]) {}
