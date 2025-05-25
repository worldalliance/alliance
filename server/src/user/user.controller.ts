import { Controller, Post, Body } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('push-token')
  async savePushToken(@Body() body: { userId: number; token: string }) {
    await this.userService.savePushToken(body.userId, body.token);
    return { success: true };
  }

  @Post('remove-push-token')
  async removePushToken(@Body() body: { userId: number }) {
    await this.userService.removePushToken(body.userId);
    return { success: true };
  }
}