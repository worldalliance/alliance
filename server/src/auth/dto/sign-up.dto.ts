import { IsDefined, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TokenMode } from './signin.dto';

export class SignUpDto {
  @IsDefined()
  @IsNotEmpty()
  @ApiProperty()
  readonly name: string;

  @IsDefined()
  @IsEmail()
  //   @Validate(IsUserAlreadyExist)
  @ApiProperty()
  readonly email: string;

  @IsDefined()
  @IsNotEmpty()
  @ApiProperty()
  readonly password: string;

  @ApiProperty({ enum: ['cookie', 'header'] })
  mode: TokenMode;

  @IsOptional()
  @ApiProperty({ required: false })
  readonly referralCode?: string;
}
