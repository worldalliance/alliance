import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import { PushDto } from "src/push/dto/push.dto";
import { OnlyThrottle } from "src/utils/throttle";
import { AuthGuard } from "../auth/guards/auth.guard";
import { Public } from "../auth/public.decorator";
import { DEVICE_UNLINK_THROTTLE } from "./device-unlink-throttle.config";
import {
  RegisterDeviceDto,
  TestPushNotificationDto,
  UnregisterDeviceDto,
  UserDeviceDto,
} from "./dto/device.dto";
import { UserDeviceService } from "./user-device.service";

@Controller("user")
export class UserDeviceController {
  constructor(private readonly userDeviceService: UserDeviceService) {}

  @Post("registerDevice")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserDeviceDto })
  async registerDevice(
    @Request() req: JwtRequest,
    @Body() body: RegisterDeviceDto,
  ): Promise<UserDeviceDto> {
    const id = await this.userDeviceService.registerDevice(req.user.sub, body);
    return new UserDeviceDto(id);
  }

  // Public so a device whose session already lapsed can still unlink;
  // holding both the device id and its push token proves it's that device.
  @Post("unregisterDevice")
  @Public()
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(DEVICE_UNLINK_THROTTLE)
  @ApiOkResponse()
  async unregisterDevice(@Body() body: UnregisterDeviceDto): Promise<void> {
    await this.userDeviceService.unregisterDevice(body);
  }

  @Post("sendPushNotification")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PushDto })
  async sendPushNotificationAdmin(
    @Body() body: TestPushNotificationDto,
  ): Promise<PushDto> {
    return new PushDto(
      await this.userDeviceService.testPushNotification(
        body.userId,
        body.message,
      ),
    );
  }
}
