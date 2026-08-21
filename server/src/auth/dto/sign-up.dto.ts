import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  Allow,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import type { TokenMode } from "./signin.dto";

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

  @Allow()
  @IsEnum(["cookie", "header"])
  @ApiProperty({ enum: ["cookie", "header"], enumName: "TokenMode" })
  mode: TokenMode;

  @IsOptional()
  @ApiPropertyOptional()
  readonly referralCode?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly guestToken?: string;
}
