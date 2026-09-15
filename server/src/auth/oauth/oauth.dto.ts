import { OAuthIntent, OAuthOutcome } from "@alliance/common/oauth";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
} from "class-validator";
import { trim } from "src/utils/transforms";
import {
  SignInResponseDto,
  type SignInResponse,
  type TokenMode,
} from "../dto/signin.dto";

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

export class OAuthNativeSignInDto {
  @ApiProperty({
    description: "The id token the provider's native SDK returned.",
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiPropertyOptional({
    description:
      "Apple hands the name to the app beside the token rather than inside it.",
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({ enum: ["cookie", "header"], enumName: "TokenMode" })
  @IsDefined()
  @IsEnum(["cookie", "header"])
  mode: TokenMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsTimeZone()
  timeZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestToken?: string;
}

export type OAuthSignInResponse = SignInResponse & { outcome: OAuthOutcome };

export class OAuthSignInResponseDto extends SignInResponseDto {
  @ApiProperty({ enum: OAuthOutcome, enumName: "OAuthOutcome" })
  outcome: OAuthOutcome;

  constructor(input: OAuthSignInResponse) {
    super(input);
    this.outcome = input.outcome;
  }
}
