import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
export type TokenMode = "cookie" | "header";

export class SignInDto {
  @ApiProperty({ enum: ["cookie", "header"] })
  @IsDefined()
  @IsEnum(["cookie", "header"])
  mode: TokenMode;

  @ApiProperty()
  @IsDefined()
  @Transform(({ value }) => value?.trim())
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestToken?: string;
}

export class SignInResponseDto {
  @ApiProperty()
  isAdmin: boolean;

  @ApiPropertyOptional()
  access_token?: string;

  @ApiPropertyOptional()
  refresh_token?: string;

  constructor(input: SignInResponse) {
    this.isAdmin = input.isAdmin;
    this.access_token = input.access_token;
    this.refresh_token = input.refresh_token;
  }
}

export type SignInResponse = {
  isAdmin: boolean;
  access_token?: string;
  refresh_token?: string;
};
