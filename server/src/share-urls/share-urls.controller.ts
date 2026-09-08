import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/guards/jwtreq";
import {
  CreateDuplicateShareLinkDto,
  CreateInviteDuplicateDto,
  GetShareLinkDto,
  ReusableInviteFeedDto,
  ReusableInviteFeedQueryDto,
  ShareLinkDto,
  ShareUrlAdminDto,
  ShareUrlMineDto,
  UpdateInviteDto,
  UpdateShareLinkLabelDto,
} from "./dto/share-url.dto";
import { type ShareUrlOwner, ShareUrlsService } from "./share-urls.service";

function ownerFromDto(body: CreateDuplicateShareLinkDto): ShareUrlOwner {
  const hasUser = body.userId !== undefined;
  const hasCampaign = body.campaignId !== undefined;
  if (hasUser === hasCampaign) {
    throw new BadRequestException(
      "Exactly one of userId or campaignId must be provided",
    );
  }
  return hasUser
    ? { type: "user", userId: body.userId! }
    : { type: "campaign", campaignId: body.campaignId! };
}

@Controller("share-urls")
export class ShareUrlsController {
  constructor(private readonly shareUrlsService: ShareUrlsService) {}

  @Post("get-share-link")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ShareLinkDto })
  async getShareLink(
    @Body() body: GetShareLinkDto,
    @Request() req: JwtRequest,
  ): Promise<ShareLinkDto> {
    const url = await this.shareUrlsService.getShareLink({
      userId: req.user.sub,
      actionId: body.actionId,
      externalTargetId: body.externalTargetId,
      invite: body.invite,
    });
    return new ShareLinkDto(url);
  }

  @Get("mine/invites")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ShareUrlMineDto, isArray: true })
  async findMyInvites(@Request() req: JwtRequest): Promise<ShareUrlMineDto[]> {
    const rows = await this.shareUrlsService.findInvitesForUser(req.user.sub);
    return rows.map((r) => new ShareUrlMineDto(r));
  }

  @Post("mine/invite-duplicate")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ShareUrlMineDto })
  async createInviteDuplicate(
    @Body() body: CreateInviteDuplicateDto,
    @Request() req: JwtRequest,
  ): Promise<ShareUrlMineDto> {
    const row = await this.shareUrlsService.createDuplicateInviteForUser(
      req.user.sub,
      body.label,
      body.communityId,
    );
    const [result] = await this.shareUrlsService.withInviteDestinations([row]);
    return new ShareUrlMineDto(result);
  }

  @Get("invite-feed")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ReusableInviteFeedDto })
  async findInviteFeedAdmin(
    @Query() query: ReusableInviteFeedQueryDto,
  ): Promise<ReusableInviteFeedDto> {
    return new ReusableInviteFeedDto(
      await this.shareUrlsService.findReusableInviteFeed(
        new Date(query.startAt),
      ),
    );
  }

  @Patch("mine/invites/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ShareUrlMineDto })
  async updateMyInvite(
    @Param("id") id: string,
    @Body() body: UpdateInviteDto,
    @Request() req: JwtRequest,
  ): Promise<ShareUrlMineDto> {
    const row = await this.shareUrlsService.updateInviteForUser({
      id,
      userId: req.user.sub,
      label: body.label,
      communityId: body.communityId,
    });
    const [result] = await this.shareUrlsService.withInviteDestinations([row]);
    return new ShareUrlMineDto(result);
  }

  @Delete("mine/invites/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async deleteMyInvite(
    @Param("id") id: string,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.shareUrlsService.deleteInviteForUser(id, req.user.sub);
  }

  @Post("create-duplicate")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlAdminDto })
  async createDuplicateAdmin(
    @Body() body: CreateDuplicateShareLinkDto,
  ): Promise<ShareUrlAdminDto> {
    const row = await this.shareUrlsService.createDuplicate({
      owner: ownerFromDto(body),
      actionId: body.actionId,
      externalTargetId: body.externalTargetId,
      invite: body.invite,
      label: body.label,
    });
    const [result] = await this.shareUrlsService.withSignupCounts([row]);
    return new ShareUrlAdminDto(result);
  }

  @Get("for-user/:userId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlAdminDto, isArray: true })
  async findForUserAdmin(
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<ShareUrlAdminDto[]> {
    const rows = await this.shareUrlsService.findForUser(userId);
    return rows.map((r) => new ShareUrlAdminDto(r));
  }

  @Get("for-campaign/:campaignId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlAdminDto, isArray: true })
  async findForCampaignAdmin(
    @Param("campaignId", ParseIntPipe) campaignId: number,
  ): Promise<ShareUrlAdminDto[]> {
    const rows = await this.shareUrlsService.findForCampaign(campaignId);
    return rows.map((r) => new ShareUrlAdminDto(r));
  }

  @Patch(":id/label")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ShareUrlAdminDto })
  async updateLabelAdmin(
    @Param("id") id: string,
    @Body() body: UpdateShareLinkLabelDto,
  ): Promise<ShareUrlAdminDto> {
    const row = await this.shareUrlsService.updateLabel(id, body.label);
    const [result] = await this.shareUrlsService.withSignupCounts([row]);
    return new ShareUrlAdminDto(result);
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteAdmin(@Param("id") id: string): Promise<void> {
    await this.shareUrlsService.deleteById(id);
  }
}
