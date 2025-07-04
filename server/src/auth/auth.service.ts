import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PWResetJwtPayload, UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../user/user.entity';
import { SignUpDto } from './dto/sign-up.dto';
import { JWTTokenType, JwtPayload } from './guards/auth.guard';
import { SignInResponseDto } from './dto/signin.dto';
import { Response } from 'express';
import { AuthTokens } from './dto/authtokens.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  public static ACCESS_COOKIE = 'access_token';
  public static REFRESH_COOKIE = 'refresh_token';

  setAuthCookies(res: Response, access: string, refresh?: string) {
    const secure = process.env.NODE_ENV === 'production';

    res.cookie(AuthService.ACCESS_COOKIE, access, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 15, // 15 min
    });
    if (refresh) {
      res.cookie(AuthService.REFRESH_COOKIE, refresh, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/auth/refresh',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });
    }
  }

  clearAuthCookies(res: Response) {
    res.clearCookie(AuthService.ACCESS_COOKIE);
    res.clearCookie(AuthService.REFRESH_COOKIE, { path: '/auth/refresh' });
  }

  async register(signUp: SignUpDto): Promise<User> {
    if (await this.usersService.findOneByEmail(signUp.email)) {
      throw new BadRequestException('User already exists');
    }

    let referredBy: User | null = null;
    if (signUp.referralCode) {
      referredBy = await this.usersService.findOneByReferralCode(
        signUp.referralCode,
      );
    }
    if (!referredBy) {
      if (process.env.NODE_ENV !== 'test') {
        throw new UnauthorizedException('invalid referral code'); //TODO: feature flag
      }
    }

    const user = await this.usersService.create({
      ...signUp,
      referredBy,
    });

    if (referredBy) {
      await this.usersService.makeFriendsAutomated(referredBy.id, user.id);
    }
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
    const token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET,
    });
    return token;
  }

  async generateAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenType: JWTTokenType.access,
    };
    return this.jwtService.signAsync(payload, { expiresIn: '15m' });
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

  async forgotPassword(email: string) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      return; // fail silently to avoid leaking emails
    }

    const token = await this.usersService.generatePasswordResetToken(user.id);
    await this.mailService.sendPasswordResetEmail(user.email, user.name, token);
    return user;
  }

  async resetPassword(token: string, password: string) {
    let payload: PWResetJwtPayload;
    try {
      payload = this.jwtService.verify<PWResetJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      console.log('payload', payload);
    } catch (error) {
      console.log('password reset jwt verification error: ', error);
      throw new UnauthorizedException();
    }

    if (payload.type !== 'password-reset') {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    const updatedUser = await this.usersService.setPassword(user.id, password);

    if (updatedUser.isNotSignedUpPartialProfile) {
      await this.usersService.update(updatedUser.id, {
        isNotSignedUpPartialProfile: false,
      });
    }
  }
}
