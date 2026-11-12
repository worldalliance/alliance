import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  GatewayTimeoutException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import {
  MmsMessageDto,
  MmsThreadDto,
  MmsThreadQueryDto,
  SendStaffTextDto,
} from "./dto/mms-thread.dto";
import { MediaRefusal, MmsMediaService } from "./mms-media.service";
import {
  MmsThreadService,
  StaffTextRefusal,
  ThreadRefusal,
} from "./mms-thread.service";
import { type StaffSendFailure, StaffSendFailureKind } from "./mms.service";

const sendFailureException = (failure: StaffSendFailure): Error => {
  switch (failure.kind) {
    case StaffSendFailureKind.Rejected:
      return new UnprocessableEntityException(failure.reason);
    case StaffSendFailureKind.Failed:
      return new BadGatewayException();
    case StaffSendFailureKind.TimedOut:
      return new GatewayTimeoutException();
    default:
      throw new Error(`unknown failure: ${failure satisfies never}`);
  }
};

const refusalException: Record<
  ThreadRefusal | StaffTextRefusal | MediaRefusal,
  () => Error
> = {
  [ThreadRefusal.MemberNotFound]: () =>
    new NotFoundException("Member not found"),
  [ThreadRefusal.BeforeNotInThread]: () =>
    new BadRequestException("That text isn't in this thread."),
  [StaffTextRefusal.NoPhoneNumber]: () =>
    new BadRequestException("This member has no phone number."),
  [StaffTextRefusal.InvalidNumber]: () =>
    new BadRequestException("This member's phone number isn't valid."),
  [StaffTextRefusal.OptedOut]: () =>
    new ConflictException("This member has opted out of texts."),
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

  @Post(":userId")
  @ApiOkResponse({ type: MmsMessageDto })
  async sendTextAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: SendStaffTextDto,
    @Request() req: JwtRequest,
  ): Promise<MmsMessageDto> {
    const sent = await this.threadService.send({
      userId,
      body: body.body,
      adminId: req.user.sub,
    });
    if (sent.ok) return new MmsMessageDto(sent.value);
    if (typeof sent.error === "string") throw refusalException[sent.error]();
    throw sendFailureException(sent.error);
  }
}
