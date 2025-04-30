import { PickType } from '@nestjs/swagger';
import { User } from '../../user/user.entity';

export class SignInDto extends PickType(User, ['email', 'password']) {}

export class ProfileDto extends PickType(User, ['email', 'name']) {}
