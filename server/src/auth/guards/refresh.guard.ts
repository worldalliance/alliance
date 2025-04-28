import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload, JWTTokenType } from './auth.guard';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    console.log('running refresh token guard');

    const authHeader = request.headers['authorization'] as string | undefined;
    if (!authHeader) {
      console.log('missing auth header');
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.split(' ')[1];

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
}
