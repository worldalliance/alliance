import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiQuery } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/guards/jwtreq";
import { AuthGuard } from "../auth/guards/auth.guard";
import { NotifClickDto, NotifClickResponseDto } from "./dto/notifclick.dto";
import { NotificationDto } from "./dto/notification.dto";
import {
  MarkUnreadContentReadDto,
  ReadNotificationQueryDto,
} from "./dto/unread-content.dto";
import { UnreadCountDto } from "./dto/unread-count.dto";
import { ActionEventNotifDto } from "./entities/action-event-notif.dto";
import { NotifsService } from "./notifs.service";

@Controller("notifs")
export class NotifsController {
  constructor(private readonly notifsService: NotifsService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ type: [NotificationDto] })
  async findAll(
    @Request() req: JwtRequest,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<NotificationDto[]> {
    return this.notifsService.findAll(req.user.sub, limit);
  }

  @Get("unread-count")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UnreadCountDto })
  async getUnreadCount(@Request() req: JwtRequest): Promise<UnreadCountDto> {
    return new UnreadCountDto(
      await this.notifsService.getUnreadCount(req.user.sub),
    );
  }

  @Post("read/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async setRead(
    @Param("id", ParseIntPipe) id: number,
    @Query() query: ReadNotificationQueryDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.notifsService.setRead(id, req.user.sub, query.sourceType);
  }

  @Post("read-all")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async setReadAll(@Request() req: JwtRequest): Promise<void> {
    return this.notifsService.setReadAll(req.user.sub);
  }

  @Post("read-content")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async setReadContent(
    @Body() body: MarkUnreadContentReadDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    return this.notifsService.setUnreadContentReadByContent(req.user.sub, body);
  }

  @UseGuards(AdminGuard)
  @Get("for-user/:id")
  @ApiOkResponse({ type: [ActionEventNotifDto] })
  async notifsForUserAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ActionEventNotifDto[]> {
    return this.notifsService
      .notifsForUser(id)
      .then((notifs) => notifs.map((notif) => new ActionEventNotifDto(notif)));
  }

  @Post("linkClick")
  @ApiOkResponse({ type: NotifClickResponseDto })
  async linkClick(@Body() body: NotifClickDto): Promise<NotifClickResponseDto> {
    return new NotifClickResponseDto(
      await this.notifsService.notifLinkClick(body),
    );
  }
}
