import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/guards/jwtreq";
import { PosthogService } from "src/posthog/posthog.service";
import { ConversationService } from "./conversation.service";
import {
  ConversationAdminSummaryDto,
  ConversationDto,
  ConversationParticipantDto,
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  UnreadMessageSummaryDto,
  UnreadMessagesDto,
  UpdateConversationDto,
} from "./dto/messaging.dto";

@ApiTags("messaging")
@Controller("messaging/conversations")
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly posthog: PosthogService,
  ) {}

  @Get("admin")
  @ApiOkResponse({ type: ConversationAdminSummaryDto, isArray: true })
  @UseGuards(AdminGuard)
  async getAllConversationsForAdmin(): Promise<ConversationAdminSummaryDto[]> {
    return this.conversationService.getAllConversationsForAdmin();
  }

  @Get()
  @ApiOkResponse({ type: ConversationDto, isArray: true })
  @UseGuards(AuthGuard)
  async getMyConversations(
    @Request() req: JwtRequest,
  ): Promise<ConversationDto[]> {
    return this.conversationService.getUserConversations(req.user.sub);
  }

  @Get("community/:communityId")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  async getCommunityConversations(
    @Param("communityId", ParseIntPipe) communityId: number,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.conversationService.getConversationForCommunity(
      communityId,
      req.user.sub,
    );
  }

  @Post("direct")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  async createDirectConversation(
    @Body() dto: CreateDirectConversationDto,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    const conversation =
      await this.conversationService.createDirectConversation(
        req.user.sub,
        dto,
      );
    this.posthog.capture({
      event: AnalyticsEvent.ConversationCreated,
      distinctId: String(req.user.sub),
      properties: {
        conversationId: conversation.id,
        kind: "direct",
      },
    });
    return conversation;
  }

  @Post("group")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  async createGroupConversation(
    @Body() dto: CreateGroupConversationDto,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    const conversation =
      await this.conversationService.createOrGetGroupConversation(
        req.user.sub,
        dto,
      );
    this.posthog.capture({
      event: AnalyticsEvent.ConversationCreated,
      distinctId: String(req.user.sub),
      properties: {
        conversationId: conversation.id,
        kind: "group",
      },
    });
    return conversation;
  }

  @Post(":conversationId/update")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  updateInfo(
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Body() body: UpdateConversationDto,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.ensureParticipantAndRun(conversationId, req.user.sub, () =>
      this.conversationService.updateConversation(
        conversationId,
        req.user.sub,
        body,
      ),
    );
  }

  @Post(":conversationId/accept")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  acceptInvite(
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.ensureParticipantAndRun(conversationId, req.user.sub, () =>
      this.conversationService.acceptInvite(conversationId, req.user.sub),
    );
  }

  @Post(":conversationId/decline")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  declineInvite(
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.ensureParticipantAndRun(conversationId, req.user.sub, () =>
      this.conversationService.declineInvite(conversationId, req.user.sub),
    );
  }

  @Post(":conversationId/participants")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  addParticipant(
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Body() body: ConversationParticipantDto,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.conversationService.addParticipantToConversation(
      conversationId,
      req.user.sub,
      body,
    );
  }

  @Delete(":conversationId/participants/:userId")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  removeParticipant(
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Param("userId", ParseIntPipe) targetUserId: number,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.conversationService.removeParticipantFromConversation(
      conversationId,
      req.user.sub,
      targetUserId,
    );
  }

  @Post(":conversationId/read")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  markRead(
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.conversationService.markConversationRead(
      conversationId,
      req.user.sub,
    );
  }

  @Get("unread")
  @ApiOkResponse({ type: UnreadMessagesDto })
  @UseGuards(AuthGuard)
  async getUnreadMessages(
    @Request() req: JwtRequest,
  ): Promise<UnreadMessagesDto> {
    const count = await this.conversationService.getUnreadMessages(
      req.user.sub,
    );
    return new UnreadMessagesDto(count);
  }

  @Get("unread-summary")
  @ApiOkResponse({ type: UnreadMessageSummaryDto })
  @UseGuards(AuthGuard)
  async getUnreadSummary(
    @Request() req: JwtRequest,
  ): Promise<UnreadMessageSummaryDto> {
    return new UnreadMessageSummaryDto(
      await this.conversationService.getUnreadSummary(req.user.sub),
    );
  }

  @Post(":conversationId/leave")
  @ApiOkResponse({ type: ConversationDto })
  @UseGuards(AuthGuard)
  leave(
    @Param("conversationId", ParseIntPipe) conversationId: number,
    @Request() req: JwtRequest,
  ): Promise<ConversationDto> {
    return this.conversationService.leaveConversation(
      conversationId,
      req.user.sub,
    );
  }

  private async ensureParticipantAndRun<T>(
    conversationId: number,
    userId: number,
    action: () => Promise<T>,
  ): Promise<T> {
    const isParticipant = await this.conversationService.isParticipant(
      conversationId,
      userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException("You are not part of this conversation.");
    }
    return action();
  }
}
