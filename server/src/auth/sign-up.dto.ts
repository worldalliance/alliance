import { IsDefined, IsNotEmpty, IsEmail, Validate } from 'class-validator';
import { IsUserAlreadyExist } from '../user/validators/user-already-exists.validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @IsDefined()
  @IsNotEmpty()
  @ApiProperty()
  readonly name: string;

  @IsDefined()
  @IsEmail()
  @Validate(IsUserAlreadyExist)
  @ApiProperty()
  readonly email: string;

  @IsDefined()
  @IsNotEmpty()
  @ApiProperty()
  readonly password: string;
}
