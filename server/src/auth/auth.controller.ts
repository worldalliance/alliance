import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  Body,
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
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ApiBearerAuth,
  ApiCookieAuth,
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
  RefreshTokensResponseDto,
} from "./dto/authtokens.dto";
import ForgotPasswordDto, { ResetPasswordDto } from "./dto/forgotpassword.dto";
import { SignUpDto } from "./dto/sign-up.dto";
import { SignInDto, SignInResponseDto, type TokenMode } from "./dto/signin.dto";
import { AdminGuard } from "./guards/admin.guard";
import {
  AuthGuard,
  extractAccessTokenFromCookie,
  extractGuestTokenFromCookie,
  extractRefreshTokenFromCookie,
  extractTokenFromHeader,
} from "./guards/auth.guard";
import type { JwtPayload, JwtRequest } from "./guards/jwtreq";
import { RefreshTokenGuard } from "./guards/refresh.guard";
import { Public } from "./public.decorator";
import { SIGNUP_THROTTLE } from "./signup-throttle.config";

class TokenModeQuery {
  @ApiPropertyOptional({ enum: ["cookie", "header"] })
  @IsOptional()
  @IsEnum(["cookie", "header"])
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
  @Post("login")
  async login(
    @Request() req: ExpressRequest,
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignInResponseDto> {
    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signInDto.email, signInDto.password);

    this.authService.setAuthCookies(res, access_token, refresh_token);
    await this.mergeGuestSession(signInDto.guestToken, req, res, userId);
    this.posthog.identify({
      distinctId: String(userId),
      properties: { email: signInDto.email },
    });
    this.posthog.capture({
      event: AnalyticsEvent.Login,
      distinctId: String(userId),
      properties: { isAdmin },
    });
    if (signInDto.mode === "header") {
      return new SignInResponseDto({ access_token, refresh_token, isAdmin });
    }
    return new SignInResponseDto({ isAdmin });
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
    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signInDto.email, signInDto.password, true);

    this.authService.setAuthCookies(res, access_token, refresh_token);
    await this.mergeGuestSession(signInDto.guestToken, req, res, userId);
    this.posthog.identify({
      distinctId: String(userId),
      properties: { email: signInDto.email },
    });
    this.posthog.capture({
      event: AnalyticsEvent.Login,
      distinctId: String(userId),
      properties: { isAdmin: true },
    });
    if (signInDto.mode === "header") {
      return new SignInResponseDto({ access_token, refresh_token, isAdmin });
    }
    return new SignInResponseDto({ isAdmin: true });
  }

  private async mergeGuestSession(
    bodyToken: string | undefined,
    req: ExpressRequest,
    res: Response,
    userId: number,
  ): Promise<void> {
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
    await this.authService.register(signUp);

    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signUp.email, signUp.password);

    this.authService.setAuthCookies(res, access_token, refresh_token);
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
    if (signUp.mode === "header") {
      return new SignInResponseDto({ access_token, refresh_token, isAdmin });
    }
    return new SignInResponseDto({ isAdmin });
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
    const userId: number = req.user.sub;
    const isImpersonation = req.user.isImpersonation ?? false;
    const { access_token, refresh_token } =
      await this.authService.refreshTokens(userId, isImpersonation);
    const mode: TokenMode =
      query.mode === "header"
        ? "header"
        : extractRefreshTokenFromCookie(req)
          ? "cookie"
          : "header";
    if (mode === "cookie") {
      this.authService.setAuthCookies(res, access_token, refresh_token);
      return new RefreshTokensResponseDto({});
    }
    return new RefreshTokensResponseDto({ access_token, refresh_token });
  }

  @Get("/me")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AuthMeResponseDto })
  async me(@Request() req: JwtRequest): Promise<AuthMeResponseDto> {
    const profile = await this.authService.getProfile(req.user.email);
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
    const token =
      extractTokenFromHeader(req) ?? extractAccessTokenFromCookie(req);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
          secret: process.env.JWT_SECRET,
        });
        this.posthog.capture({
          event: AnalyticsEvent.Logout,
          distinctId: String(payload.sub),
        });
      } catch {
        // expired/invalid token — nothing to attribute
      }
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
    @Res() res: Response,
  ): Promise<void> {
    const { access_token, refresh_token } =
      await this.authService.generateImpersonationTokens(userId);

    this.authService.setAuthCookies(res, access_token, refresh_token);

    if (!process.env.APP_URL) {
      throw new Error("APP_URL is not set");
    }

    const frontendUrl = process.env.APP_URL + "/tasks";
    res.redirect(frontendUrl);
  }
}
