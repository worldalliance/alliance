import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../user/user.entity';
import { SignUp } from './sign-up.dto';
import { JWTTokenType, JwtPayload } from './guards/auth.guard';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
  ) {}

  async register(signUp: SignUp): Promise<User> {
    const user = await this.usersService.create(signUp);
    return user;
  }

  async login(
    email: string,
    password: string,
    adminOnly: boolean = false,
  ): Promise<{ access_token: string; refresh_token: string }> {
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
    return this.jwtService.signAsync(payload, { expiresIn: '15m' });
  }

  async refreshAccessToken(userId: number): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid user id');
    }
    return {
      access_token: await this.generateAccessToken(user),
    };
  }

  async getProfile(email: string): Promise<User> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException();
    }
    console.log(user);
    return user;
  }
}
