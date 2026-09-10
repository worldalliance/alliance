import { OAuthIntent } from "@alliance/common/oauth";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
} from "class-validator";

export class OAuthStartDto {
  @ApiProperty({ enum: OAuthIntent, enumName: "OAuthIntent" })
  @IsDefined()
  @IsEnum(OAuthIntent)
  intent: OAuthIntent;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  returnTo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsTimeZone()
  timeZone?: string;
}

export class OAuthCallbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({
    description:
      "JSON Apple posts on the first authorization, holding the name.",
  })
  @IsOptional()
  @IsString()
  user?: string;
}
