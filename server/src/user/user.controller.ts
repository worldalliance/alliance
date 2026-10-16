/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { AnalyticsEvent } from "@alliance/common/analytics";
import { R } from "@alliance/common/result";
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { CommunityLeaderGuard } from "src/auth/guards/communityleader.guard";
import type { JwtRequest } from "src/auth/tokens";
import { MaybeUserLocationDto } from "src/geo/city.dto";
import { PosthogService } from "src/posthog/posthog.service";
import { PaginationQueryDto } from "src/utils/pagination.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { Public } from "../auth/public.decorator";
import {
  AmbassadorInviteDashboardDto,
  AmbassadorInviteGoalDto,
  AmbassadorProgramDashboardDto,
  AmbassadorProgramMemberDto,
  CreateAmbassadorInviteGoalDto,
  CreateAmbassadorProgramInteractionDto,
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  OnetimeInviteEdgeDto,
  OnetimeInviteListDto,
  OnetimeInviteMemberStatsDto,
  RequestOnetimeInviteDto,
  UpdateAmbassadorInviteGoalDto,
  UpdateAmbassadorProgramMemberDto,
  UpdateOnetimeInviteDto,
  UpsertAmbassadorProgramMemberDto,
} from "./dto/invite.dto";
import {
  DeleteUserAdminDto,
  MyVisibilityContextDto,
  NMembersResponseDto,
  ProfileDto,
  ProfileDtoWithFriends,
  StaffDirectoryEntryDto,
  UpdateProfileDto,
  UpdateStaffDirectoryDto,
  UpdateUserRolesAdminDto,
  UserAdminDetailDto,
  UserCityCountDto,
  UserDto,
} from "./dto/user.dto";
import { UserService } from "./user.service";

class VerifyEmailBody {
  @IsString()
  @IsNotEmpty()
  token: string;
}

@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly posthog: PosthogService,
  ) {}

  @Get("me")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  async findMe(@Request() req: JwtRequest): Promise<ProfileDto> {
    const profile = await this.userService.findOne(req.user.sub);
    if (!profile) {
      throw new UnauthorizedException();
    }
    return new ProfileDto(profile);
  }

  @Post("update")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  async update(
    @Body() updateActionDto: UpdateProfileDto,
    @Request() req: JwtRequest,
  ): Promise<ProfileDto> {
    return new ProfileDto(
      await this.userService.update(req.user.sub, updateActionDto),
    );
  }

  @Post("switch-domain")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ description: "Opted in to the new domain" })
  @ApiUnauthorizedResponse()
  async switchDomain(@Request() req: JwtRequest): Promise<void> {
    await this.userService.markDomainSwitched(req.user.sub);
  }

  @Get("mylocation")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MaybeUserLocationDto })
  async myLocation(@Request() req: JwtRequest): Promise<MaybeUserLocationDto> {
    const city = await this.userService.getUserLocation(req.user.sub);
    return new MaybeUserLocationDto(city);
  }

  @Get("myvisibilitycontext")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MyVisibilityContextDto })
  async myVisibilityContext(
    @Request() req: JwtRequest,
  ): Promise<MyVisibilityContextDto> {
    return new MyVisibilityContextDto(
      await this.userService.getVisibilityContext(req.user.sub),
    );
  }

  @Get("listMessageableUsers")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async listMessageableUsers(
    @Request() req: JwtRequest,
  ): Promise<ProfileDto[]> {
    if (!req.user) {
      throw new UnauthorizedException("User not found");
    }
    return (await this.userService.findMessageableUsers(req.user.sub)).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get("list")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listAdmin(): Promise<UserDto[]> {
    return (await this.userService.findAllForAdminList()).map(
      (user) => new UserDto(user),
    );
  }

  @Get("list-graph")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listForGraphAdmin(): Promise<UserDto[]> {
    return (
      await this.userService.findAll({
        contractEvents: true,
        communities: true,
        tags: true,
      })
    ).map((user) => new UserDto(user));
  }

  @Get("cityCounts")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UserCityCountDto] })
  async cityCountsAdmin(): Promise<UserCityCountDto[]> {
    return (await this.userService.getUserCityCounts()).map(
      (c) => new UserCityCountDto(c),
    );
  }

  @Get("userdetail/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAdminDetailDto })
  async userDetailAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<UserAdminDetailDto> {
    const user = await this.userService.findAdminDetail(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return new UserAdminDetailDto(user);
  }

  @Patch("userdetail/:id/roles")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAdminDetailDto })
  async updateUserRolesAdmin(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateUserRolesAdminDto,
  ): Promise<UserAdminDetailDto> {
    return new UserAdminDetailDto(
      await this.userService.updateRolesAdmin({
        id,
        actorId: req.user.sub,
        roles: body,
      }),
    );
  }

  @Delete("userdetail/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteUserAdmin(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: DeleteUserAdminDto,
  ): Promise<void> {
    await this.userService.deleteUserAdmin({
      userId: id,
      adminId: req.user.sub,
      reason: body.reason,
      confirmationEmail: body.confirmationEmail,
      screenshotKey: body.screenshotKey,
    });
  }

  @Get("list-public")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listPublicAdmin(): Promise<UserDto[]> {
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new UserDto(user),
    );
  }

  @Get("members")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async members(): Promise<ProfileDto[]> {
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get("members-public")
  @Public()
  @ApiOkResponse({ type: [ProfileDto] })
  async membersPublic(): Promise<ProfileDto[]> {
    return (await this.userService.findAllMembersPublic()).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get("staff-directory")
  @Public()
  @ApiOkResponse({ type: [StaffDirectoryEntryDto] })
  async staffDirectory(): Promise<StaffDirectoryEntryDto[]> {
    return (await this.userService.findStaffDirectory()).map(
      (user) => new StaffDirectoryEntryDto(user),
    );
  }

  @Get("staff-directory-admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [StaffDirectoryEntryDto] })
  async staffDirectoryAdmin(): Promise<StaffDirectoryEntryDto[]> {
    return (await this.userService.findStaffDirectory()).map(
      (user) => new StaffDirectoryEntryDto(user),
    );
  }

  @Put("staff-directory-admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [StaffDirectoryEntryDto] })
  async updateStaffDirectoryAdmin(
    @Body() body: UpdateStaffDirectoryDto,
  ): Promise<StaffDirectoryEntryDto[]> {
    return (await this.userService.updateStaffDirectory(body.items)).map(
      (user) => new StaffDirectoryEntryDto(user),
    );
  }

  @Get("membersWithFriends")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDtoWithFriends] })
  async membersWithFriends(
    @Query("requireSignedContract", new DefaultValuePipe(false), ParseBoolPipe)
    requireSignedContract: boolean,
  ): Promise<ProfileDtoWithFriends[]> {
    const [users, friendIdsByUserId] = await Promise.all([
      this.userService.findAll({ contractEvents: true }),
      this.userService.findAcceptedFriendIdsByUserId(),
    ]);

    const members = requireSignedContract
      ? users.filter((user) => user.hasActiveContract)
      : users;

    return members.map(
      (user) =>
        new ProfileDtoWithFriends(user, friendIdsByUserId.get(user.id) ?? []),
    );
  }

  @Get("myprofile")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  async myProfile(@Request() req: JwtRequest): Promise<ProfileDto> {
    const user = await this.userService.findOne(req.user.sub, {
      contractEvents: true,
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return new ProfileDto(user);
  }

  @Get("slug/:id")
  @Public()
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<ProfileDto> {
    const user = await this.userService.findOne(id, { contractEvents: true });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return new ProfileDto(user);
  }

  @Post("verifyEmail")
  @Public()
  @ApiOkResponse()
  async verifyEmail(@Body() body: VerifyEmailBody): Promise<void> {
    return this.userService.verifyEmail(body.token);
  }

  @Post("nmembers")
  @Public()
  @ApiOkResponse({ type: NMembersResponseDto })
  async nmembers(): Promise<NMembersResponseDto> {
    return new NMembersResponseDto(await this.userService.signedMembersCount());
  }

  @Get("ambassadorProgram")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramDashboardDto })
  async getAmbassadorProgramAdmin(): Promise<AmbassadorProgramDashboardDto> {
    return new AmbassadorProgramDashboardDto(
      await this.userService.getAmbassadorProgramDashboard(),
    );
  }

  @Post("ambassadorProgram/member")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramMemberDto })
  async upsertAmbassadorProgramMemberAdmin(
    @Body() body: UpsertAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMemberDto> {
    return new AmbassadorProgramMemberDto(
      await this.userService.upsertAmbassadorProgramMember(body),
    );
  }

  @Patch("ambassadorProgram/member/:userId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramMemberDto })
  async updateAmbassadorProgramMemberAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: UpdateAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMemberDto> {
    return new AmbassadorProgramMemberDto(
      await this.userService.updateAmbassadorProgramMember(userId, body),
    );
  }

  @Post("ambassadorProgram/interaction")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramMemberDto })
  async createAmbassadorProgramInteractionAdmin(
    @Body() body: CreateAmbassadorProgramInteractionDto,
    @Request() req: JwtRequest,
  ): Promise<AmbassadorProgramMemberDto> {
    return new AmbassadorProgramMemberDto(
      await this.userService.createAmbassadorProgramInteraction(
        body,
        req.user.sub,
      ),
    );
  }

  @Get("onetimeInvite/:code")
  @Public()
  @ApiOkResponse({ type: OnetimeInviteDto })
  async onetimeInvite(@Param("code") code: string): Promise<OnetimeInviteDto> {
    const invite = await this.userService.findInviteByCode(code);
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
    const invite = await this.userService.requestOnetimeInvite(
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
    const invite = await this.userService.approveOnetimeInviteRequest(
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
    return this.userService.rejectOnetimeInviteRequest(inviteId, req.user.sub);
  }

  @Post("onetimeInvite/create")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async createOnetimeInvite(
    @Body() body: CreateOnetimeInviteDto,
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto> {
    const invite = await this.userService.createOnetimeInvite(
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

  @Get("ambassadorInvites/dashboard")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AmbassadorInviteDashboardDto })
  async getAmbassadorInviteDashboard(
    @Request() req: JwtRequest,
  ): Promise<AmbassadorInviteDashboardDto> {
    return new AmbassadorInviteDashboardDto(
      await this.userService.getAmbassadorInviteDashboard(req.user.sub),
    );
  }

  @Post("ambassadorInvites/goal")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AmbassadorInviteGoalDto })
  async createAmbassadorInviteGoal(
    @Body() body: CreateAmbassadorInviteGoalDto,
    @Request() req: JwtRequest,
  ): Promise<AmbassadorInviteGoalDto> {
    return new AmbassadorInviteGoalDto(
      await this.userService.createAmbassadorInviteGoal(body, req.user.sub),
    );
  }

  @Patch("ambassadorInvites/goal/:goalId")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AmbassadorInviteGoalDto })
  async updateAmbassadorInviteGoal(
    @Param("goalId", ParseIntPipe) goalId: number,
    @Body() body: UpdateAmbassadorInviteGoalDto,
    @Request() req: JwtRequest,
  ): Promise<AmbassadorInviteGoalDto> {
    return new AmbassadorInviteGoalDto(
      await this.userService.updateAmbassadorInviteGoal(
        goalId,
        body,
        req.user.sub,
      ),
    );
  }

  @Delete("ambassadorInvites/goal/:goalId")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async deleteAmbassadorInviteGoal(
    @Param("goalId", ParseIntPipe) goalId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.userService.deleteAmbassadorInviteGoal(goalId, req.user.sub);
  }

  @Patch("onetimeInvites/:inviteId")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async updateOnetimeInvite(
    @Param("inviteId", ParseIntPipe) inviteId: number,
    @Body() body: UpdateOnetimeInviteDto,
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto> {
    const invite = await this.userService.updateOnetimeInvite({
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
    await this.userService.deleteOnetimeInvite(inviteId, req.user.sub);
  }

  @Get("onetimeInvites")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: OnetimeInviteListDto })
  async getOnetimeInvitesAdmin(
    @Query() query: PaginationQueryDto,
  ): Promise<OnetimeInviteListDto> {
    return new OnetimeInviteListDto(
      await this.userService.findAllOnetimeInvites(query),
    );
  }

  @Get("onetimeInvites/memberStats")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [OnetimeInviteMemberStatsDto] })
  async getOnetimeInviteMemberStatsAdmin(): Promise<
    OnetimeInviteMemberStatsDto[]
  > {
    return (await this.userService.getOnetimeInviteMemberStats()).map(
      (stats) => new OnetimeInviteMemberStatsDto(stats),
    );
  }

  @Get("onetimeInvites/graphEdges")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [OnetimeInviteEdgeDto] })
  async getOnetimeInviteGraphEdgesAdmin(): Promise<OnetimeInviteEdgeDto[]> {
    return (await this.userService.findOnetimeInviteEdges()).map(
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
      await this.userService.findOnetimeInvitesOverviewForUser(req.user.sub)
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
      await this.userService.findOnetimeInvites(req.user.sub, communityId)
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
      await this.userService.findOnetimeInvitesByRequester(
        req.user.sub,
        communityId,
      )
    ).map((invite) => new OnetimeInviteDto(invite));
  }

  @Post("requestAccountDeletion")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async requestAccountDeletion(@Request() req: JwtRequest): Promise<void> {
    R.unwrap(await this.userService.requestAccountDeletion(req.user.sub));
  }
}
