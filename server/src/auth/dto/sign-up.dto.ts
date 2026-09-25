import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";
import { IsTimeZoneIdentifier } from "src/utils/timezone";
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

  @ValidateIf((_object, value) => value !== null)
  @IsDefined()
  @IsTimeZoneIdentifier()
  @ApiProperty({ type: String, nullable: true })
  readonly timeZone: string | null;

  @IsOptional()
  @ApiPropertyOptional()
  readonly referralCode?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  readonly guestToken?: string;
}
