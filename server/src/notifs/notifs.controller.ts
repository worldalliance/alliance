import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { NotifsService } from './notifs.service';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { ApiOkResponse } from '@nestjs/swagger';
import { NotificationDto } from './dto/notification.dto';

@Controller('notifs')
export class NotifsController {
  constructor(private readonly notifsService: NotifsService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [NotificationDto] })
  findAll(@Request() req: JwtRequest): Promise<NotificationDto[]> {
    return this.notifsService.findAll(req.user.sub);
  }

  @Post('read/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  setRead(@Param('id', ParseIntPipe) id: number, @Request() req: JwtRequest) {
    return this.notifsService.setRead(id, req.user.sub);
  }
}
