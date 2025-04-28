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
import { SignInDto } from './dto/signin.dto';
import { RefreshTokenGuard } from './guards/refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() signInDto: SignInDto) {
    return this.authService.login(signInDto.email, signInDto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('admin/login')
  adminLogin(@Body() signInDto: SignInDto) {
    return this.authService.login(signInDto.email, signInDto.password, true);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() signUp: SignUp): Promise<{ success: boolean }> {
    await this.authService.register(signUp);
    return { success: true };
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  refreshTokens(@Request() req: JwtRequest) {
    const userId: number = req.user.sub;
    return this.authService.refreshAccessToken(userId);
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  async me(
    @Request() req: JwtRequest,
  ): Promise<{ email: string; name: string }> {
    console.log('getting profile profile: ', req.user);
    const profile = await this.authService.getProfile(req.user.email);
    return { email: profile.email, name: profile.name };
  }
}
