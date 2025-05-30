import { Controller, Post, Body, Request, UseGuards, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { JwtRequest } from 'src/auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Post('pushToken')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Save push notification token for a user' })
  @ApiBody({ description: 'Push token data', type: Object })
  async savePushToken(@Request() req: JwtRequest, @Body() body: { token: string }) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    await this.userService.savePushToken(req.user.sub, body.token);
    return { success: true };
  }

  @Post('removePushToken')
  @ApiOperation({ summary: 'Remove push notification token for a user' })
  @ApiBody({ description: 'User ID for token removal', type: Object })
  async removePushToken(@Body() body: { userId: number }) {
    await this.userService.removePushToken(body.userId);
    return { success: true };
  }
}