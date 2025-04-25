import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { SignUp } from './sign-up.dto';
import { User } from 'src/user/user.entity';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() signInDto: Record<string, any>) {
    return this.authService.login(signInDto.email, signInDto.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() signUp: SignUp): Promise<{ success: boolean }> {
    this.authService.register(signUp);
    return Promise.resolve({ success: true });
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  async me(@Request() req): Promise<{ email: string; name: string }> {
    console.log('getting profile profile: ', req.user);
    const profile = await this.authService.getProfile(req.user.email);
    return { email: profile.email, name: profile.name };
  }
}
