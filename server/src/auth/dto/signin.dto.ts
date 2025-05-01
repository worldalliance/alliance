import { ApiProperty, PickType } from '@nestjs/swagger';
import { User } from '../../user/user.entity';
import { AuthTokens } from './authtokens.dto';

export class SignInDto extends PickType(User, ['email', 'password']) {}

export class ProfileDto extends PickType(User, ['email', 'name', 'admin']) {}

export class SignInResponseDto extends AuthTokens {
  @ApiProperty()
  isAdmin: boolean;
}
