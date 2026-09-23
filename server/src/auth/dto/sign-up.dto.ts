import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
} from "class-validator";
import { TokenMode } from "./signin.dto";

export class SignUpDto {
  @IsDefined()
  @IsNotEmpty()
  @ApiProperty()
  readonly name: string;

  @IsDefined()
  @Transform(({ value }) => value?.trim())
  @IsEmail()
  //   @Validate(IsUserAlreadyExist)
  @ApiProperty()
  readonly email: string;

  @IsDefined()
  @IsNotEmpty()
  @ApiProperty()
  readonly password: string;

  @IsDefined()
  @IsEnum(TokenMode)
  @ApiProperty({ enum: TokenMode, enumName: "TokenMode" })
  mode: TokenMode;

  @IsDefined()
  @IsTimeZone()
  @ApiProperty()
  readonly timeZone: string;

  @IsOptional()
  @ApiPropertyOptional()
  readonly referralCode?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly guestToken?: string;
}
