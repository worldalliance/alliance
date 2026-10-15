import { AnalyticsEvent } from "@alliance/common/analytics";
import { thrownStack } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
import { REVIEW_SIGN_IN_FAILED_PARAM } from "@alliance/common/review-account";
import {
  ACCOUNT_MOVED_MESSAGE,
  isLegacyAllianceHost,
} from "@alliance/common/url";
import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiPropertyOptional,
  ApiResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { IsEnum, IsOptional } from "class-validator";
import type { Request as ExpressRequest, Response } from "express";
import { PosthogService } from "src/posthog/posthog.service";
import { OnlyThrottle } from "src/utils/throttle";
import { AuthService } from "./auth.service";
import {
  AuthMeResponseDto,
  type RefreshTokensResponse,
  RefreshTokensResponseDto,
} from "./dto/authtokens.dto";
import ForgotPasswordDto, { ResetPasswordDto } from "./dto/forgotpassword.dto";
import { SignUpDto } from "./dto/sign-up.dto";
import {
  ReviewSignInDto,
  SignInDto,
  SignInResponseDto,
  TokenMode,
} from "./dto/signin.dto";
import { AdminGuard } from "./guards/admin.guard";
import { AuthGuard } from "./guards/auth.guard";
import { RefreshTokenGuard } from "./guards/refresh.guard";
import { Public } from "./public.decorator";
import { OAUTH_THROTTLE, SIGNUP_THROTTLE } from "./signup-throttle.config";
import { siteUrlForHost } from "./site-url";
import {
  extractGuestTokenFromCookie,
  extractRefreshTokenFromCookie,
  type JwtRequest,
  sessionFromRequest,
} from "./tokens";

const MODE_USES_COOKIES: Record<TokenMode, boolean> = {
  [TokenMode.Cookie]: true,
  [TokenMode.Header]: false,
};

class TokenModeQuery {
  @ApiPropertyOptional({ enum: TokenMode, enumName: "TokenMode" })
  @IsOptional()
  @IsEnum(TokenMode)
  mode?: TokenMode;
}

@ApiBearerAuth()
@ApiCookieAuth()
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private posthog: PosthogService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SignInResponseDto })
  @ApiUnauthorizedResponse()
  @ApiConflictResponse({
    description: "Migrated account signing in on the legacy domain",
  })
  @ApiForbiddenResponse({
    description: "Review account, which signs in on staging",
  })
  @Post("login")
  async login(
    @Request() req: ExpressRequest,
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignInResponseDto> {
    this.clearHeaderModeCookies(res, signInDto.mode);
    const { access_token, refresh_token, isAdmin, userId, switchedDomainAt } =
      await this.authService.login(signInDto.email, signInDto.password);

    // A cookie session cannot follow them to the new domain, so signing them in
    // here only to have the web app bounce them is a loop. Header sessions are
    // the mobile app, which has one API host and never moves.
    if (
      MODE_USES_COOKIES[signInDto.mode] &&
      switchedDomainAt !== null &&
      isLegacyAllianceHost(req.get("host") ?? "")
    ) {
      throw new ConflictException(ACCOUNT_MOVED_MESSAGE);
    }

    await this.mergeGuestSession(signInDto.guestToken, req, res, userId);
    this.recordLogin({ userId, email: signInDto.email, isAdmin });
    return new SignInResponseDto({
      ...this.deliverTokens({
        res,
        mode: signInDto.mode,
        access_token,
        refresh_token,
      }),
      isAdmin,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SignInResponseDto })
  @ApiUnauthorizedResponse()
  @Post("admin/login")
  async adminLogin(
    @Request() req: ExpressRequest,
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignInResponseDto> {
    this.clearHeaderModeCookies(res, signInDto.mode);
    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signInDto.email, signInDto.password, true);

    await this.mergeGuestSession(signInDto.guestToken, req, res, userId);
    this.recordLogin({ userId, email: signInDto.email, isAdmin: true });
    return new SignInResponseDto({
      ...this.deliverTokens({
        res,
        mode: signInDto.mode,
        access_token,
        refresh_token,
      }),
      isAdmin,
    });
  }

  /**
   * Production's web login hands a review account here as a top-level form
   * post, which can set this host's cookies even from a cross-site page.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(OAUTH_THROTTLE)
  @Post("review-login")
  @ApiResponse({
    status: HttpStatus.SEE_OTHER,
    description: "Redirects to the web app, signed in or with the failure",
  })
  async reviewLogin(
    @Request() req: ExpressRequest,
    @Body() body: ReviewSignInDto,
    @Res() res: Response,
  ): Promise<void> {
    const siteUrl = this.siteUrl(req);
    const tokens = await R.fromPromise(
      this.authService.reviewLogin(body.email, body.password),
    );
    if (!tokens.ok) {
      // The reviewer is mid-navigation, where an exception filter's JSON body
      // would strand them.
      if (!(tokens.error instanceof UnauthorizedException)) {
        console.error("review sign-in failed", thrownStack(tokens.error));
      }
      res.redirect(
        HttpStatus.SEE_OTHER,
        `${siteUrl}/login?${REVIEW_SIGN_IN_FAILED_PARAM}=1`,
      );
      return;
    }
    this.recordLogin({
      userId: tokens.value.userId,
      email: body.email,
      isAdmin: tokens.value.isAdmin,
    });
    this.authService.setAuthCookies(
      res,
      tokens.value.access_token,
      tokens.value.refresh_token,
    );
    res.redirect(HttpStatus.SEE_OTHER, `${siteUrl}/tasks`);
  }

  private recordLogin(params: {
    userId: number;
    email: string;
    isAdmin: boolean;
  }): void {
    this.posthog.identify({
      distinctId: String(params.userId),
      properties: { email: params.email },
    });
    this.posthog.capture({
      event: AnalyticsEvent.Login,
      distinctId: String(params.userId),
      properties: { isAdmin: params.isAdmin },
    });
  }

  // `extractAccessToken` falls back to the access cookie, so a cookie beside
  // header-mode tokens is a second session the client doesn't track. Clearing
  // before the handler's work also drops it when the sign-in is rejected.
  private clearHeaderModeCookies(res: Response, mode: TokenMode): void {
    if (!MODE_USES_COOKIES[mode]) {
      this.authService.clearAuthCookies(res);
    }
  }

  private deliverTokens(params: {
    res: Response;
    mode: TokenMode;
    access_token: string;
    refresh_token: string;
  }): RefreshTokensResponse {
    if (MODE_USES_COOKIES[params.mode]) {
      this.authService.setAuthCookies(
        params.res,
        params.access_token,
        params.refresh_token,
      );
      return {};
    }
    return {
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    };
  }

  private async mergeGuestSession(
    bodyToken: string | undefined,
    req: ExpressRequest,
    res: Response,
    userId: number,
  ): Promise<void> {
    // Mobile sends the guest token in the body, web in the cookie.
    const guestToken = bodyToken ?? extractGuestTokenFromCookie(req);
    if (!guestToken) {
      return;
    }
    await this.authService.mergeGuestFromToken(guestToken, userId);
    this.authService.clearGuestCookie(res);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(SIGNUP_THROTTLE)
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "User created successfully",
    type: SignInResponseDto,
  })
  @ApiUnauthorizedResponse()
  async register(
    @Request() req: ExpressRequest,
    @Body() signUp: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignInResponseDto> {
    this.clearHeaderModeCookies(res, signUp.mode);
    await this.authService.register(signUp);

    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signUp.email, signUp.password);

    await this.mergeGuestSession(signUp.guestToken, req, res, userId);
    this.posthog.identify({
      distinctId: String(userId),
      properties: { email: signUp.email, name: signUp.name },
    });
    this.posthog.capture({
      event: AnalyticsEvent.NewUser,
      distinctId: String(userId),
      properties: {
        email: signUp.email,
        name: signUp.name,
        referral_code: signUp.referralCode,
      },
    });
    return new SignInResponseDto({
      ...this.deliverTokens({
        res,
        mode: signUp.mode,
        access_token,
        refresh_token,
      }),
      isAdmin,
    });
  }

  @Post("refresh")
  @UseGuards(RefreshTokenGuard)
  @ApiOkResponse({ type: RefreshTokensResponseDto })
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Request() req: JwtRequest,
    @Query() query: TokenModeQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokensResponseDto> {
    const mode =
      query.mode ??
      (extractRefreshTokenFromCookie(req)
        ? TokenMode.Cookie
        : TokenMode.Header);
    this.clearHeaderModeCookies(res, mode);
    const userId: number = req.user.sub;
    const isImpersonation = req.user.isImpersonation ?? false;
    const { access_token, refresh_token } =
      await this.authService.refreshTokens(userId, isImpersonation);
    return new RefreshTokensResponseDto(
      this.deliverTokens({ res, mode, access_token, refresh_token }),
    );
  }

  @Get("/me")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AuthMeResponseDto })
  async me(@Request() req: JwtRequest): Promise<AuthMeResponseDto> {
    const profile = await this.authService.getProfile(req.user.sub);
    return new AuthMeResponseDto({
      user: profile,
      isImpersonation: req.user.isImpersonation ? true : undefined,
    });
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  async logout(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    this.authService.clearAuthCookies(res);

    // Logout is unauthenticated; best-effort resolve the user from a still-valid
    // access token so we can attribute the event.
    try {
      const payload = await sessionFromRequest(this.jwtService, req);
      this.posthog.capture({
        event: AnalyticsEvent.Logout,
        distinctId: String(payload.sub),
      });
    } catch {
      // missing or invalid token, nothing to attribute
    }
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(body.token, body.password);
  }

  @Get("impersonate/:userId")
  @UseGuards(AdminGuard)
  @ApiResponse({
    status: 302,
    description: "Redirects to frontend as the specified user",
  })
  async impersonateAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Request() req: ExpressRequest,
    @Res() res: Response,
  ): Promise<void> {
    const { access_token, refresh_token } =
      await this.authService.generateImpersonationTokens(userId);

    this.authService.setAuthCookies(res, access_token, refresh_token);

    res.redirect(this.siteUrl(req) + "/tasks");
  }

  private siteUrl(req: ExpressRequest): string {
    if (!process.env.APP_URL) {
      throw new Error("APP_URL is not set");
    }
    return siteUrlForHost({
      host: req.get("host"),
      appUrl: process.env.APP_URL,
      altAppUrl: process.env.ALT_APP_URL,
    });
  }
}
