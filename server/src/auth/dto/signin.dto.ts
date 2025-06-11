import { ApiProperty, PickType } from '@nestjs/swagger';
import { User } from '../../user/user.entity';

export type TokenMode = 'cookie' | 'header';

export class SignInDto extends PickType(User, ['email', 'password']) {
  @ApiProperty({ enum: ['cookie', 'header'] })
  mode: TokenMode;
}

export class SignInResponseDto {
  @ApiProperty()
  isAdmin: boolean;

  @ApiProperty()
  access_token?: string;

  @ApiProperty()
  refresh_token?: string;
}
