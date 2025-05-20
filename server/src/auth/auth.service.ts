import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../user/user.entity';
import { SignUpDto } from './sign-up.dto';
import { JWTTokenType, JwtPayload } from './guards/auth.guard';
import { SignInResponseDto } from './dto/signin.dto';
import { Response } from 'express';
import { AuthTokens } from './dto/authtokens.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
  ) {}

  private static ACCESS_COOKIE = 'access_token';
  private static REFRESH_COOKIE = 'refresh_token';

  setAuthCookies(res: Response, access: string, refresh?: string) {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(AuthService.ACCESS_COOKIE, access, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 15, // 15 min
    });
    res.cookie(AuthService.REFRESH_COOKIE, refresh, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/auth/refresh', // refresh cookie sent only to this route
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie(AuthService.ACCESS_COOKIE);
    res.clearCookie(AuthService.REFRESH_COOKIE, { path: '/auth/refresh' });
  }

  async register(signUp: SignUpDto): Promise<User> {
    const user = await this.usersService.create(signUp);
    return user;
  }

  async login(
    email: string,
    password: string,
    adminOnly: boolean = false,
  ): Promise<SignInResponseDto & AuthTokens> {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      throw new UnauthorizedException();
    }

    if (!(await user.checkPassword(password))) {
      throw new UnauthorizedException();
    }

    if (adminOnly && !user.admin) {
      throw new UnauthorizedException();
    }

    return {
      access_token: await this.generateAccessToken(user),
      refresh_token: await this.generateRefreshToken(user),
      isAdmin: user.admin,
    };
  }

  async generateRefreshToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenType: JWTTokenType.refresh,
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET,
    });
  }

  async generateAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenType: JWTTokenType.access,
    };
    return this.jwtService.signAsync(payload, { expiresIn: '15s' });
  }

  async refreshAccessToken(userId: number): Promise<string> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid user id');
    }
    return await this.generateAccessToken(user);
  }

  async getProfile(email: string): Promise<User> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
