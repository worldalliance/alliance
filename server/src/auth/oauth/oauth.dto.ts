import { OAuthError, OAuthIntent } from "@alliance/common/oauth";
import type { Result } from "@alliance/common/result";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { UserDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { IsTimeZoneIdentifier } from "src/utils/timezone";

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
  @IsTimeZoneIdentifier()
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

export class MobileIdentityTokenDto {
  @ApiProperty({
    description: "The id token the provider's native SDK issued.",
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestToken?: string;
}

export class MobileOAuthHandoffDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  handoff: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  proof: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestToken?: string;
}

export class MobileOAuthLinkIdentityTokenDto extends PickType(
  MobileIdentityTokenDto,
  ["identityToken"],
) {
  @ApiProperty({
    description:
      "The member the app started linking for, refused unless still signed in.",
  })
  @IsDefined()
  @IsInt()
  userId: number;
}

export class MobileOAuthLinkHandoffDto extends PickType(MobileOAuthHandoffDto, [
  "handoff",
  "proof",
]) {}

export type MobileOAuthBrowserSession = {
  url: string;
  proof: string;
  returnTo: string;
};

export class MobileOAuthBrowserSessionDto {
  @ApiProperty({ description: "The provider's consent screen." })
  url: string;

  @ApiProperty({ description: "Sent back with the handoff to redeem it." })
  proof: string;

  @ApiProperty({
    description: "The link the browser session comes back to the app on.",
  })
  returnTo: string;

  constructor(input: MobileOAuthBrowserSession) {
    this.url = input.url;
    this.proof = input.proof;
    this.returnTo = input.returnTo;
  }
}

export type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export class SessionTokensDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  constructor(input: SessionTokens) {
    this.access_token = input.access_token;
    this.refresh_token = input.refresh_token;
  }
}

export type MobileOAuthSignIn = Result<SessionTokens, OAuthError>;

/** Exactly one of `session` and `error` is set. */
export class MobileOAuthSignInDto {
  @ApiPropertyOptional({ type: () => SessionTokensDto })
  session?: SessionTokensDto;

  @ApiPropertyOptional({ enum: OAuthError, enumName: "OAuthError" })
  error?: OAuthError;

  constructor(input: MobileOAuthSignIn) {
    if (input.ok) {
      this.session = new SessionTokensDto(input.value);
    } else {
      this.error = input.error;
    }
  }
}

export type OAuthLink = Result<User, OAuthError>;

/** Exactly one of `user` and `error` is set. */
export class OAuthLinkDto {
  @ApiPropertyOptional({ type: () => UserDto })
  user?: UserDto;

  @ApiPropertyOptional({ enum: OAuthError, enumName: "OAuthError" })
  error?: OAuthError;

  constructor(input: OAuthLink) {
    if (input.ok) {
      this.user = new UserDto(input.value);
    } else {
      this.error = input.error;
    }
  }
}
