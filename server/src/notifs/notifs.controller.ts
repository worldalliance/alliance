import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { NotificationDto } from './dto/notification.dto';
import { ActionEventNotifDto } from './entities/action-event-notif.dto';
import { NotifsService } from './notifs.service';
import { NotifClickDto, NotifClickResponseDto } from './dto/notifclick.dto';

@Controller('notifs')
export class NotifsController {
  constructor(private readonly notifsService: NotifsService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [NotificationDto] })
  findAll(@Request() req: JwtRequest): Promise<NotificationDto[]> {
    return this.notifsService
      .findAll(req.user.sub)
      .then((notifs) => notifs.map((notif) => new NotificationDto(notif)));
  }

  @Post('read/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  setRead(@Param('id', ParseIntPipe) id: number, @Request() req: JwtRequest) {
    return this.notifsService.setRead(id, req.user.sub);
  }

  @Post('read-all')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  setReadAll(@Request() req: JwtRequest) {
    return this.notifsService.setReadAll(req.user.sub);
  }

  @Post('clear')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  clear(@Request() req: JwtRequest) {
    return this.notifsService.clear(req.user.sub);
  }

  @UseGuards(AdminGuard)
  @Get('for-user/:id')
  @ApiOkResponse({ type: [ActionEventNotifDto] })
  notifsForUser(@Param('id', ParseIntPipe) id: number) {
    return this.notifsService
      .notifsForUser(id)
      .then((notifs) => notifs.map((notif) => new ActionEventNotifDto(notif)));
  }

  @Post('linkClick')
  @ApiOkResponse({ type: NotifClickResponseDto })
  linkClick(@Body() body: NotifClickDto) {
    return this.notifsService.notifLinkClick(body);
  }
}
