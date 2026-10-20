import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { CommunityLeaderGuard } from "src/auth/guards/communityleader.guard";
import type { JwtRequest } from "src/auth/tokens";
import { PosthogService } from "src/posthog/posthog.service";
import { PaginationQueryDto } from "src/utils/pagination.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { Public } from "../auth/public.decorator";
import {
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  OnetimeInviteEdgeDto,
  OnetimeInviteListDto,
  OnetimeInviteMemberStatsDto,
  RequestOnetimeInviteDto,
  UpdateOnetimeInviteDto,
} from "./dto/onetime-invite.dto";
import { OnetimeInviteService } from "./onetime-invite.service";

@Controller("user")
export class UserOnetimeInviteController {
  constructor(
    private readonly onetimeInviteService: OnetimeInviteService,
    private readonly posthog: PosthogService,
  ) {}

  @Get("onetimeInvite/:code")
  @Public()
  @ApiOkResponse({ type: OnetimeInviteDto })
  async onetimeInvite(@Param("code") code: string): Promise<OnetimeInviteDto> {
    const invite = await this.onetimeInviteService.findInviteByCode(code);
    if (!invite) {
      throw new NotFoundException("Invite not found");
    }
    return new OnetimeInviteDto(invite);
  }

  @Post("onetimeInvite/request")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async requestOnetimeInvite(
    @Body() body: RequestOnetimeInviteDto,
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto> {
    const invite = await this.onetimeInviteService.requestOnetimeInvite(
      body,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.OnetimeInviteRequested,
      distinctId: String(req.user.sub),
      properties: {
        inviteId: invite.id,
        communityId: invite.communityId,
        invitee: invite.invitee,
      },
    });
    return new OnetimeInviteDto(invite);
  }

  @Post("onetimeInvite/:inviteId/approve")
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async approveOnetimeInvite(
    @Param("inviteId", ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto> {
    const invite = await this.onetimeInviteService.approveOnetimeInviteRequest(
      inviteId,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.OnetimeInviteApproved,
      distinctId: String(req.user.sub),
      properties: {
        inviteId: invite.id,
        communityId: invite.communityId,
        invitee: invite.invitee,
      },
    });
    return new OnetimeInviteDto(invite);
  }

  @Post("onetimeInvite/:inviteId/reject")
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse()
  async rejectOnetimeInvite(
    @Param("inviteId", ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    return this.onetimeInviteService.rejectOnetimeInviteRequest(
      inviteId,
      req.user.sub,
    );
  }

  @Post("onetimeInvite/create")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async createOnetimeInvite(
    @Body() body: CreateOnetimeInviteDto,
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto> {
    const invite = await this.onetimeInviteService.createOnetimeInvite(
      body,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.OnetimeInviteCreated,
      distinctId: String(req.user.sub),
      properties: {
        inviteId: invite.id,
        communityId: invite.communityId,
        invitee: invite.invitee,
      },
    });
    return new OnetimeInviteDto(invite);
  }

  @Patch("onetimeInvites/:inviteId")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async updateOnetimeInvite(
    @Param("inviteId", ParseIntPipe) inviteId: number,
    @Body() body: UpdateOnetimeInviteDto,
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto> {
    const invite = await this.onetimeInviteService.updateOnetimeInvite({
      inviteId,
      userId: req.user.sub,
      invitee: body.invitee,
      communityId: body.communityId,
    });
    return new OnetimeInviteDto(invite);
  }

  @Delete("onetimeInvites/:inviteId")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async deleteOnetimeInvite(
    @Param("inviteId", ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.onetimeInviteService.deleteOnetimeInvite(inviteId, req.user.sub);
  }

  @Get("onetimeInvites")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: OnetimeInviteListDto })
  async getOnetimeInvitesAdmin(
    @Query() query: PaginationQueryDto,
  ): Promise<OnetimeInviteListDto> {
    return new OnetimeInviteListDto(
      await this.onetimeInviteService.findAllOnetimeInvites(query),
    );
  }

  @Get("onetimeInvites/memberStats")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [OnetimeInviteMemberStatsDto] })
  async getOnetimeInviteMemberStatsAdmin(): Promise<
    OnetimeInviteMemberStatsDto[]
  > {
    return (await this.onetimeInviteService.getOnetimeInviteMemberStats()).map(
      (stats) => new OnetimeInviteMemberStatsDto(stats),
    );
  }

  @Get("onetimeInvites/graphEdges")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [OnetimeInviteEdgeDto] })
  async getOnetimeInviteGraphEdgesAdmin(): Promise<OnetimeInviteEdgeDto[]> {
    return (await this.onetimeInviteService.findOnetimeInviteEdges()).map(
      (edge) => new OnetimeInviteEdgeDto(edge),
    );
  }

  @Get("onetimeInvites/overview")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto, isArray: true })
  async getOnetimeInvitesOverview(
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto[]> {
    return (
      await this.onetimeInviteService.findOnetimeInvitesOverviewForUser(
        req.user.sub,
      )
    ).map((invite) => new OnetimeInviteDto(invite));
  }

  @Get("onetimeInvites/:communityId")
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: [OnetimeInviteDto] })
  async getOnetimeInvitesByCommunity(
    @Param("communityId", ParseIntPipe) communityId: number,
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto[]> {
    return (
      await this.onetimeInviteService.findOnetimeInvites(
        req.user.sub,
        communityId,
      )
    ).map((invite) => new OnetimeInviteDto(invite));
  }

  @Get("onetimeInvites/:communityId/my")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [OnetimeInviteDto] })
  async getOnetimeInvitesByRequester(
    @Request() req: JwtRequest,
    @Param("communityId", ParseIntPipe) communityId: number,
  ): Promise<OnetimeInviteDto[]> {
    return (
      await this.onetimeInviteService.findOnetimeInvitesByRequester(
        req.user.sub,
        communityId,
      )
    ).map((invite) => new OnetimeInviteDto(invite));
  }
}
