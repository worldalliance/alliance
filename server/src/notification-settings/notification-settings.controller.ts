import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/tokens";
import {
  NotificationSettingsAdminDto,
  NotificationSettingsDto,
  UpdateNotificationSettingsDto,
} from "./dto/notification-settings.dto";
import { NotificationSettingsService } from "./notification-settings.service";

@Controller("user")
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get("notification-settings")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: NotificationSettingsDto })
  async get(@Request() req: JwtRequest): Promise<NotificationSettingsDto> {
    return new NotificationSettingsDto(await this.settings.get(req.user.sub));
  }

  @Patch("notification-settings")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: NotificationSettingsDto })
  async update(
    @Request() req: JwtRequest,
    @Body() body: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    return new NotificationSettingsDto(
      await this.settings.update(req.user.sub, body),
    );
  }

  @Get("userdetail/:id/notification-settings")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: NotificationSettingsAdminDto })
  async getAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<NotificationSettingsAdminDto> {
    return new NotificationSettingsAdminDto(await this.settings.getAdmin(id));
  }
}
