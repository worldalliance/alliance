import { AnalyticsEvent } from '@alliance/common/analytics';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { CommunityLeaderGuard } from 'src/auth/guards/communityleader.guard';
import type { JwtRequest } from 'src/auth/guards/jwtreq';
import { PosthogService } from 'src/posthog/posthog.service';
import {
  CommunityInviteDto,
  CreateCommunityInviteDto,
  RequestCommunityInviteDto,
} from 'src/user/dto/invite.dto';
import { CommunityMemberContactInfoDto } from 'src/user/dto/user-action-relations.dto';
import { CommunityService } from './community.service';
import {
  CommunityDto,
  CommunityMemberDto,
  CreateCommunityDto,
  MoveCommunityMemberDto,
  UpdateCommunityDto,
} from './dto/community.dto';

@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly posthog: PosthogService,
  ) {}

  @Post('create/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async createCommunityAdmin(
    @Body() body: CreateCommunityDto,
  ): Promise<CommunityDto> {
    return new CommunityDto(
      await this.communityService.createCommunityAdmin(body),
    );
  }

  @Post('create')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityDto })
  async createCommunity(
    @Request() req: JwtRequest,
    @Body() body: CreateCommunityDto,
  ): Promise<CommunityDto> {
    const community = await this.communityService.createCommunity(
      req.user.sub,
      body,
    );
    this.posthog.capture({
      event: AnalyticsEvent.CommunityCreated,
      distinctId: String(req.user.sub),
      properties: {
        communityId: community.id,
      },
    });
    return new CommunityDto(community);
  }

  @Get('list')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [CommunityDto] })
  async getCommunitiesAdmin(): Promise<CommunityDto[]> {
    return (await this.communityService.findAllCommunities()).map(
      (community) => new CommunityDto(community),
    );
  }

  @Get('list/public')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [CommunityDto] })
  async getPublicCommunities(): Promise<CommunityDto[]> {
    return (await this.communityService.findPublicCommunities()).map(
      (community) => new CommunityDto(community),
    );
  }

  @Get('list/my')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityDto, isArray: true })
  async getMyCommunities(@Request() req: JwtRequest): Promise<CommunityDto[]> {
    const communities = await this.communityService.findUserCommunities(
      req.user.sub,
    );
    return communities.map((community) => new CommunityDto(community));
  }

  @Post(':communityId/join')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityDto })
  async joinPublicCommunity(
    @Request() req: JwtRequest,
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityDto> {
    const community = await this.communityService.joinPublicCommunity(
      req.user.sub,
      communityId,
    );
    this.posthog.capture({
      event: AnalyticsEvent.CommunityJoined,
      distinctId: String(req.user.sub),
      properties: {
        communityId,
        via: 'public',
      },
    });
    return new CommunityDto(community);
  }

  @Patch(':communityId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: CommunityDto })
  async update(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: UpdateCommunityDto,
    @Request() req: JwtRequest,
  ): Promise<CommunityDto> {
    return new CommunityDto(
      await this.communityService.updateCommunity(
        communityId,
        body,
        req.user.sub,
      ),
    );
  }

  @Post(':communityId/removeMember')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityDto })
  async removeMember(
    @Request() req: JwtRequest,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ): Promise<CommunityDto> {
    return new CommunityDto(
      await this.communityService.removeUserFromCommunity({
        userId: req.user.sub,
        removeeId: body.userId,
        communityId,
      }),
    );
  }

  @Post(':communityId/removeMember/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async removeMemberAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ): Promise<CommunityDto> {
    return new CommunityDto(
      await this.communityService.removeUserFromCommunityAdmin(
        communityId,
        body.userId,
      ),
    );
  }

  @Post(':communityId/moveMember/admin')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async moveMemberAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: MoveCommunityMemberDto,
  ): Promise<void> {
    await this.communityService.moveUserBetweenCommunitiesAdmin({
      sourceCommunityId: communityId,
      destinationCommunityId: body.destinationCommunityId,
      userId: body.userId,
    });
  }

  @Post(':communityId/leave')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async leave(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.communityService.leaveCommunity(communityId, req.user.sub);
    this.posthog.capture({
      event: AnalyticsEvent.CommunityLeft,
      distinctId: String(req.user.sub),
      properties: {
        communityId,
      },
    });
  }

  @Delete(':communityId')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async delete(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.communityService.deleteCommunity(req.user.sub, communityId);
  }

  @Delete(':communityId/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<void> {
    await this.communityService.deleteCommunityAdmin(communityId);
  }

  @Post(':communityId/addMember/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async addMemberAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ): Promise<CommunityDto> {
    return new CommunityDto(
      await this.communityService.addUserToCommunityAdmin({
        communityId,
        userId: body.userId,
      }),
    );
  }

  @Post(':communityId/addLeader/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async addLeaderAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ): Promise<CommunityDto> {
    return new CommunityDto(
      await this.communityService.addLeaderAdmin(communityId, body.userId),
    );
  }

  @Post(':communityId/removeLeader/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async removeLeaderAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ): Promise<CommunityDto> {
    return new CommunityDto(
      await this.communityService.removeLeaderAdmin(communityId, body.userId),
    );
  }

  @Get('memberContactInfo/:communityId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: CommunityMemberContactInfoDto, isArray: true })
  async getMemberContactInfo(
    @Request() req: JwtRequest,
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityMemberContactInfoDto[]> {
    const items = await this.communityService.getMemberContactInfo({
      leaderId: req.user.sub,
      communityId,
    });
    return items.map((item) => new CommunityMemberContactInfoDto(item));
  }

  @Get('memberContactInfo/:communityId/admin')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityMemberContactInfoDto, isArray: true })
  async getMemberContactInfoAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityMemberContactInfoDto[]> {
    const items = await this.communityService.getMemberContactInfo({
      communityId,
    });
    return items.map((item) => new CommunityMemberContactInfoDto(item));
  }

  @Get('memberContactInfo')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityMemberContactInfoDto, isArray: true })
  async getAllMemberContactInfoAdmin(): Promise<
    CommunityMemberContactInfoDto[]
  > {
    const items = await this.communityService.getAllMemberContactInfoAdmin();
    return items.map((item) => new CommunityMemberContactInfoDto(item));
  }

  @Post('communityInvites/create')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: CommunityInviteDto })
  async createCommunityInvite(
    @Body() body: CreateCommunityInviteDto,
    @Request() req: JwtRequest,
  ): Promise<CommunityInviteDto> {
    const invite = await this.communityService.createCommunityInvite(
      body,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.CommunityInviteCreated,
      distinctId: String(req.user.sub),
      properties: {
        inviteId: invite.id,
        communityId: invite.community?.id,
        invitedUserId: invite.invitedUser?.id,
      },
    });
    return new CommunityInviteDto(invite);
  }

  @Delete('communityInvites/:inviteId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse()
  async deleteCommunityInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.communityService.deleteCommunityInvite(inviteId, req.user.sub);
  }

  @Post('communityInvites/request')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityInviteDto })
  async requestCommunityInvite(
    @Body() body: RequestCommunityInviteDto,
    @Request() req: JwtRequest,
  ): Promise<CommunityInviteDto> {
    const invite = await this.communityService.requestCommunityInvite(
      body,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.CommunityInviteRequested,
      distinctId: String(req.user.sub),
      properties: {
        inviteId: invite.id,
        communityId: invite.community?.id,
        invitedUserId: invite.invitedUser?.id,
      },
    });
    return new CommunityInviteDto(invite);
  }

  @Post('communityInvites/:inviteId/approveRequest')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: CommunityInviteDto })
  async approveCommunityInviteRequest(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<CommunityInviteDto> {
    const invite = await this.communityService.approveCommunityInviteRequest(
      inviteId,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.CommunityInviteApproved,
      distinctId: String(req.user.sub),
      properties: {
        inviteId: invite.id,
        communityId: invite.community?.id,
        invitedUserId: invite.invitedUser?.id,
      },
    });
    return new CommunityInviteDto(invite);
  }

  @Post('communityInvites/:inviteId/rejectRequest')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse()
  async rejectCommunityInviteRequest(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.communityService.rejectCommunityInviteRequest(
      inviteId,
      req.user.sub,
    );
  }

  @Get('communityInvites/community/:communityId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: [CommunityInviteDto] })
  async getCommunityInvites(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Request() req: JwtRequest,
  ): Promise<CommunityInviteDto[]> {
    return (
      await this.communityService.findCommunityInvites(
        req.user.sub,
        communityId,
      )
    ).map((invite) => new CommunityInviteDto(invite));
  }

  @Get('communityInvites')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [CommunityInviteDto] })
  async getIncomingCommunityInvitesForUser(
    @Request() req: JwtRequest,
  ): Promise<CommunityInviteDto[]> {
    return (
      await this.communityService.findIncomingCommunityInvitesForUser(
        req.user.sub,
      )
    ).map((invite) => new CommunityInviteDto(invite));
  }

  @Post('communityInvites/:inviteId/accept')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async acceptCommunityInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    const communityId = await this.communityService.acceptCommunityInvite(
      inviteId,
      req.user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.CommunityJoined,
      distinctId: String(req.user.sub),
      properties: {
        communityId,
        via: 'invite',
        inviteId,
      },
    });
  }

  @Post('communityInvites/:inviteId/reject')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async rejectCommunityInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.communityService.rejectCommunityInvite(inviteId, req.user.sub);
  }
}
