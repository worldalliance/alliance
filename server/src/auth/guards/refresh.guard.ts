import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload, JWTTokenType } from './auth.guard';
import { Request } from 'express';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    console.log('running refresh token guard');

    const token =
      this.extractTokenFromCookie(request) ??
      this.extractTokenFromHeader(request);

    if (!token) {
      console.log('missing token');
      throw new UnauthorizedException('Missing refresh token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      if (payload.tokenType !== JWTTokenType.refresh) {
        console.log('invalid token type');
        throw new UnauthorizedException('Invalid token type');
      }

      // Attach user info to request for later use
      request['user'] = payload;
      request['refreshToken'] = token;

      return true;
    } catch (err) {
      console.log('refresh token guard error: ', err);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.refresh_token;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers['authorization'] as string | undefined;
    if (!authHeader) {
      console.log('missing auth header');
      throw new UnauthorizedException('Missing authorization header');
    }

    return authHeader.split(' ')[1];
  }
}
