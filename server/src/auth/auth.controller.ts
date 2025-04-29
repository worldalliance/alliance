import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { SignUp } from './sign-up.dto';
import { AuthGuard, JwtRequest } from './guards/auth.guard';
import { ProfileDto, SignInDto } from './dto/signin.dto';
import { RefreshTokenGuard } from './guards/refresh.guard';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessToken, AuthTokens } from './dto/authtokens.dto';

@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokens })
  @ApiUnauthorizedResponse()
  @Post('login')
  login(@Body() signInDto: SignInDto) {
    return this.authService.login(signInDto.email, signInDto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokens })
  @ApiUnauthorizedResponse()
  @Post('admin/login')
  adminLogin(@Body() signInDto: SignInDto) {
    return this.authService.login(signInDto.email, signInDto.password, true);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  @ApiUnauthorizedResponse()
  async register(@Body() signUp: SignUp): Promise<{ success: boolean }> {
    await this.authService.register(signUp);
    return { success: true };
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @ApiOkResponse({ type: AccessToken })
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Request() req: JwtRequest) {
    const userId: number = req.user.sub;
    return { access_token: await this.authService.refreshAccessToken(userId) };
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  async me(
    @Request() req: JwtRequest,
  ): Promise<{ email: string; name: string }> {
    const profile = await this.authService.getProfile(req.user.email);
    return { email: profile.email, name: profile.name };
  }
}
