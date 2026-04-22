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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiPropertyOptional,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request as ExpressRequest, Response } from 'express';
import { UserDto } from '../user/dto/user.dto';
import { AuthService } from './auth.service';
import { AuthTokens, AuthMeResponseDto } from './dto/authtokens.dto';
import ForgotPasswordDto, { ResetPasswordDto } from './dto/forgotpassword.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto, SignInResponseDto, type TokenMode } from './dto/signin.dto';
import { AdminGuard } from './guards/admin.guard';
import {
  AuthGuard,
  extractGuestTokenFromCookie,
  extractRefreshTokenFromCookie,
} from './guards/auth.guard';
import type { JwtRequest } from './guards/jwtreq';
import { RefreshTokenGuard } from './guards/refresh.guard';
import { Public } from './public.decorator';
import { IsEnum, IsOptional } from 'class-validator';

class TokenModeQuery {
  @ApiPropertyOptional({ enum: ['cookie', 'header'] })
  @IsOptional()
  @IsEnum(['cookie', 'header'])
  mode?: TokenMode;
}

@ApiBearerAuth()
@ApiCookieAuth()
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SignInResponseDto })
  @ApiUnauthorizedResponse()
  @Post('login')
  async login(
    @Request() req: ExpressRequest,
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signInDto.email, signInDto.password);

    this.authService.setAuthCookies(res, access_token, refresh_token);
    await this.mergeGuestSession(signInDto.guestToken, req, res, userId);
    if (signInDto.mode === 'header') {
      return { access_token, refresh_token, isAdmin };
    }
    return { isAdmin };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SignInResponseDto })
  @ApiUnauthorizedResponse()
  @Post('admin/login')
  async adminLogin(
    @Request() req: ExpressRequest,
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signInDto.email, signInDto.password, true);

    this.authService.setAuthCookies(res, access_token, refresh_token);
    await this.mergeGuestSession(signInDto.guestToken, req, res, userId);
    if (signInDto.mode === 'header') {
      return { access_token, refresh_token, isAdmin };
    }
    return { isAdmin: true };
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
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
    type: SignInResponseDto,
  })
  @ApiUnauthorizedResponse()
  async register(
    @Request() req: ExpressRequest,
    @Body() signUp: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    access_token?: string;
    refresh_token?: string;
    isAdmin: boolean;
  }> {
    await this.authService.register(signUp);

    const { access_token, refresh_token, isAdmin, userId } =
      await this.authService.login(signUp.email, signUp.password);

    this.authService.setAuthCookies(res, access_token, refresh_token);
    await this.mergeGuestSession(signUp.guestToken, req, res, userId);
    if (signUp.mode === 'header') {
      return { access_token, refresh_token, isAdmin };
    }
    return { isAdmin };
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @ApiOkResponse({ type: AuthTokens })
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Request() req: JwtRequest,
    @Query() query: TokenModeQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId: number = req.user.sub;
    const isImpersonation = req.user.isImpersonation ?? false;
    const { access_token, refresh_token } =
      await this.authService.refreshTokens(userId, isImpersonation);
    const mode: TokenMode =
      query.mode === 'header'
        ? 'header'
        : extractRefreshTokenFromCookie(req)
          ? 'cookie'
          : 'header';
    if (mode === 'cookie') {
      this.authService.setAuthCookies(res, access_token, refresh_token);
      return;
    }
    return { access_token, refresh_token };
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AuthMeResponseDto })
  async me(@Request() req: JwtRequest): Promise<AuthMeResponseDto> {
    const profile = await this.authService.getProfile(req.user.email);
    const user = new UserDto(profile);
    return {
      user,
      ...(req.user.isImpersonation && { isImpersonation: true }),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  async logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
  }

  @Get('impersonate/:userId')
  @UseGuards(AdminGuard)
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend as the specified user',
  })
  async impersonate(
    @Param('userId', ParseIntPipe) userId: number,
    @Res() res: Response,
  ) {
    const { access_token, refresh_token } =
      await this.authService.generateImpersonationTokens(userId);

    this.authService.setAuthCookies(res, access_token, refresh_token);

    if (!process.env.APP_URL) {
      throw new Error('APP_URL is not set');
    }

    const frontendUrl = process.env.APP_URL + '/tasks';
    res.redirect(frontendUrl);
  }
}
