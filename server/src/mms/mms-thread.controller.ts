import { NON_MEMBER_REPLY_WINDOW_DAYS } from "@alliance/common/staffText";
import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  GatewayTimeoutException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import {
  MarkThreadDto,
  MmsMessageDto,
  MmsThreadDto,
  MmsThreadQueryDto,
  NeedsReplyMemberDto,
  NeedsReplyThreadDto,
  NumberThreadDto,
  SendStaffTextDto,
  ThreadListDto,
  ThreadListQueryDto,
} from "./dto/mms-thread.dto";
import { MmsInboxService } from "./mms-inbox.service";
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
  [ThreadRefusal.TextNotInThread]: () =>
    new BadRequestException("That text isn't in this thread."),
  [ThreadRefusal.ThreadNotFound]: () =>
    new NotFoundException("Thread not found"),
  [StaffTextRefusal.NoPhoneNumber]: () =>
    new BadRequestException("This member has no phone number."),
  [StaffTextRefusal.InvalidNumber]: () =>
    new BadRequestException(
      "This phone number can't receive texts from staff.",
    ),
  [StaffTextRefusal.OptedOut]: () =>
    new ConflictException("This number has opted out of texts."),
  [StaffTextRefusal.ReplyWindowClosed]: () =>
    new ConflictException(
      `This number hasn't texted in the last ${NON_MEMBER_REPLY_WINDOW_DAYS} days, so staff can reply only once it texts again.`,
    ),
  [MediaRefusal.NoCopy]: () => new NotFoundException(),
};

@Controller("mms-threads")
@UseGuards(AdminGuard)
@ApiUnauthorizedResponse()
export class MmsThreadController {
  constructor(
    private readonly threadService: MmsThreadService,
    private readonly mediaService: MmsMediaService,
    private readonly inboxService: MmsInboxService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ThreadListDto })
  async listThreadsAdmin(
    @Query() query: ThreadListQueryDto,
  ): Promise<ThreadListDto> {
    return new ThreadListDto(
      await this.inboxService.list({
        page: query.page ?? 1,
        limit: query.limit ?? 50,
        search: query.search,
      }),
    );
  }

  /** BACKCOMPAT(mms-thread-ids): admin builds before per-number threads read
   * this; remove once no deployed admin build calls it, moving the Needs reply
   * tests in the mms-needs-reply, mms-number-opt-out and mms-number-thread e2e
   * files to needs-reply-threads and deleting the per-member one. */
  @Get("needs-reply")
  @ApiOkResponse({ type: [NeedsReplyMemberDto] })
  async needsReplyAdmin(): Promise<NeedsReplyMemberDto[]> {
    return (await this.inboxService.needsReplyMembers()).map(
      (entry) => new NeedsReplyMemberDto(entry),
    );
  }

  @Get("needs-reply-threads")
  @ApiOkResponse({ type: [NeedsReplyThreadDto] })
  async needsReplyThreadsAdmin(): Promise<NeedsReplyThreadDto[]> {
    return (await this.inboxService.needsReply()).map(
      (entry) => new NeedsReplyThreadDto(entry),
    );
  }

  @Get("by-id/:threadId")
  @ApiOkResponse({ type: NumberThreadDto })
  async getNumberThreadAdmin(
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Query() query: MmsThreadQueryDto,
  ): Promise<NumberThreadDto> {
    const thread = await this.threadService.getNumberThread({
      threadId,
      before: query.before,
    });
    if (!thread.ok) throw refusalException[thread.error]();
    return new NumberThreadDto(thread.value);
  }

  @Post("by-id/:threadId")
  @ApiCreatedResponse({ type: MmsMessageDto })
  async sendInThreadAdmin(
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Body() body: SendStaffTextDto,
    @Request() req: JwtRequest,
  ): Promise<MmsMessageDto> {
    const sent = await this.threadService.sendInThread({
      threadId,
      body: body.body,
      adminId: req.user.sub,
    });
    if (sent.ok) return new MmsMessageDto(sent.value);
    if (typeof sent.error === "string") throw refusalException[sent.error]();
    throw sendFailureException(sent.error);
  }

  @Post("by-id/:threadId/opt-out")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async markThreadOptedOutAdmin(
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const marked = await this.threadService.markOptedOutInThread({
      threadId,
      adminId: req.user.sub,
    });
    if (!marked.ok) throw refusalException[marked.error]();
  }

  @Post("by-id/:threadId/handled")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async markThreadHandledAdmin(
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Body() body: MarkThreadDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const marked = await this.threadService.markHandledInThread({
      threadId,
      throughId: body.throughId,
      adminId: req.user.sub,
    });
    if (!marked.ok) throw refusalException[marked.error]();
  }

  @Post("by-id/:threadId/needs-reply")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async markThreadNeedsReplyAdmin(
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Body() body: MarkThreadDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const marked = await this.threadService.markNeedsReplyInThread({
      threadId,
      throughId: body.throughId,
      adminId: req.user.sub,
    });
    if (!marked.ok) throw refusalException[marked.error]();
  }

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

  @Post(":userId/opt-out")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async markOptedOutAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const marked = await this.threadService.markOptedOut({
      userId,
      adminId: req.user.sub,
    });
    if (!marked.ok) throw refusalException[marked.error]();
  }

  @Post(":userId/handled")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async markHandledAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: MarkThreadDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const marked = await this.threadService.markHandled({
      userId,
      throughId: body.throughId,
      adminId: req.user.sub,
    });
    if (!marked.ok) throw refusalException[marked.error]();
  }

  @Post(":userId/needs-reply")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async markNeedsReplyAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: MarkThreadDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const marked = await this.threadService.markNeedsReply({
      userId,
      throughId: body.throughId,
      adminId: req.user.sub,
    });
    if (!marked.ok) throw refusalException[marked.error]();
  }
}
