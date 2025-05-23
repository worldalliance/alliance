import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { SignUpDto } from './sign-up.dto';
import {
  AuthGuard,
  extractRefreshTokenFromCookie,
  JwtRequest,
} from './guards/auth.guard';
import { RequestMode, SignInDto, SignInResponseDto } from './dto/signin.dto';
import { RefreshTokenGuard } from './guards/refresh.guard';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessToken } from './dto/authtokens.dto';
import { Response } from 'express';
import { UserDto } from 'src/user/user.dto';

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
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token, isAdmin } =
      await this.authService.login(signInDto.email, signInDto.password);

    this.authService.setAuthCookies(res, access_token, refresh_token);
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
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token, isAdmin } =
      await this.authService.login(signInDto.email, signInDto.password, true);

    this.authService.setAuthCookies(res, access_token, refresh_token);
    if (signInDto.mode === 'header') {
      return { access_token, refresh_token, isAdmin };
    }
    return { isAdmin: true };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  @ApiUnauthorizedResponse()
  async register(@Body() signUp: SignUpDto): Promise<{ success: boolean }> {
    await this.authService.register(signUp);
    return { success: true };
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @ApiOkResponse({ type: AccessToken })
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Request() req: JwtRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId: number = req.user.sub;
    const access_token = await this.authService.refreshAccessToken(userId);
    const mode: RequestMode = extractRefreshTokenFromCookie(req)
      ? 'cookie'
      : 'header';
    if (mode === 'cookie') {
      this.authService.setAuthCookies(res, access_token);
      return;
    }
    return { access_token };
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserDto })
  async me(@Request() req: JwtRequest): Promise<UserDto> {
    const profile = await this.authService.getProfile(req.user.email);
    return {
      email: profile.email,
      name: profile.name,
      admin: profile.admin,
      id: profile.id,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
    return { success: true };
  }
}
