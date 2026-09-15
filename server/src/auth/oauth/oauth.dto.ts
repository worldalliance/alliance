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

export type OAuthConsent = {
  consentUrl: string;
  proof: string;
};

export class OAuthConsentDto {
  @ApiProperty()
  consentUrl: string;

  @ApiProperty({
    description: "Present this with the handoff at /exchange or /link.",
  })
  proof: string;

  constructor(input: OAuthConsent) {
    this.consentUrl = input.consentUrl;
    this.proof = input.proof;
  }
}

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

/** What the app trades the callback's deep link for, at /link or /exchange. */
export class OAuthHandoffDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  handoff: string;

  @ApiProperty({ description: "The secret /auth/:provider/start handed back." })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  proof: string;
}

export class OAuthExchangeDto extends OAuthHandoffDto {
  @ApiProperty({ enum: ["cookie", "header"], enumName: "TokenMode" })
  @IsDefined()
  @IsEnum(["cookie", "header"])
  mode: TokenMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestToken?: string;
}

/** What a provider's native SDK hands the app, and the app hands us. */
export class OAuthIdentityTokenDto {
  @ApiProperty({
    description: "The id token the provider's native SDK returned.",
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  identityToken: string;
}

export class OAuthNativeSignInDto extends OAuthIdentityTokenDto {
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
