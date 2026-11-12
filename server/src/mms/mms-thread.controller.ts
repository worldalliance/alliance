import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { MmsThreadDto, MmsThreadQueryDto } from "./dto/mms-thread.dto";
import { MediaRefusal, MmsMediaService } from "./mms-media.service";
import { MmsThreadService, ThreadRefusal } from "./mms-thread.service";

const refusalException: Record<ThreadRefusal | MediaRefusal, () => Error> = {
  [ThreadRefusal.MemberNotFound]: () =>
    new NotFoundException("Member not found"),
  [ThreadRefusal.BeforeNotInThread]: () =>
    new BadRequestException("That text isn't in this thread."),
  [MediaRefusal.NoCopy]: () => new NotFoundException(),
};

@Controller("mms-threads")
@UseGuards(AdminGuard)
@ApiUnauthorizedResponse()
export class MmsThreadController {
  constructor(
    private readonly threadService: MmsThreadService,
    private readonly mediaService: MmsMediaService,
  ) {}

  @Get("media/:id")
  @ApiResponse({
    status: 302,
    description: "Redirects to a short-lived signed link",
  })
  async mediaAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.mediaService.signedUrl(id);
    if (!url.ok) throw refusalException[url.error]();
    res.redirect(url.value);
  }

  @Get(":userId")
  @ApiOkResponse({ type: MmsThreadDto })
  async getThreadAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Query() query: MmsThreadQueryDto,
  ): Promise<MmsThreadDto> {
    const thread = await this.threadService.getThread({
      userId,
      before: query.before,
    });
    if (!thread.ok) throw refusalException[thread.error]();
    return new MmsThreadDto(thread.value);
  }
}
