import { ApiProperty, PickType } from '@nestjs/swagger';
import { User } from '../../user/user.entity';

export type RequestMode = 'cookie' | 'header';

export class SignInDto extends PickType(User, ['email', 'password']) {
  @ApiProperty({ enum: ['cookie', 'header'] })
  mode: RequestMode;
}

export class ProfileDto extends PickType(User, ['email', 'name', 'admin']) {}

export class SignInResponseDto {
  @ApiProperty()
  isAdmin: boolean;

  @ApiProperty()
  access_token?: string;

  @ApiProperty()
  refresh_token?: string;
}
