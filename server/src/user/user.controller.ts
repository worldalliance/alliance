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
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { CommunityLeaderGuard } from "src/auth/guards/communityleader.guard";
import type { JwtRequest } from "src/auth/guards/jwtreq";
import { MaybeUserLocationDto } from "src/geo/city.dto";
import { PosthogService } from "src/posthog/posthog.service";
import { PushDto } from "src/push/dto/push.dto";
import { PaginationQueryDto } from "src/utils/pagination.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { Public } from "../auth/public.decorator";
import {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from "./dto/away-range.dto";
import {
  RegisterDeviceDto,
  RegisterLiveActivityPushToStartTokenDto,
  RegisterLiveActivityUpdateTokenDto,
  TestPushNotificationDto,
  UserDeviceDto,
} from "./dto/device.dto";
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
  AddUserToTagDto,
  CreateTagDto,
  TagDto,
  TagSummaryDto,
} from "./dto/tag.dto";
import {
  AssignGroupsDto,
  DeleteUserAdminDto,
  FriendStatusDto,
  MyVisibilityContextDto,
  NMembersResponseDto,
  ProfileDto,
  ProfileDtoWithFriends,
  ReferrerProfileDto,
  SignupSocialProofDto,
  StaffDirectoryEntryDto,
  UpdateProfileDto,
  UpdateStaffDirectoryDto,
  UpdateUserRolesAdminDto,
  UserAdminDetailDto,
  UserCityCountDto,
  UserDto,
} from "./dto/user.dto";
import { FriendStatus } from "./entities/friend.entity";
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

  @Post("awayranges")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async createAwayRange(
    @Request() req: JwtRequest,
    @Body() body: CreateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.createAwayRange(req.user.sub, body),
    );
  }

  @Get("awayranges")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [UserAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRanges(@Request() req: JwtRequest): Promise<UserAwayRangeDto[]> {
    return (await this.userService.getAwayRanges(req.user.sub)).map(
      (range) => new UserAwayRangeDto(range),
    );
  }

  @Delete("awayranges/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async deleteAwayRange(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userService.deleteAwayRange(req.user.sub, id);
  }

  @Patch("awayranges/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async updateAwayRange(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.updateAwayRange(req.user.sub, id, body),
    );
  }

  @Get("awayranges/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UserAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRangeForUserAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<UserAwayRangeDto[]> {
    return (await this.userService.getAwayRanges(id)).map(
      (range) => new UserAwayRangeDto(range),
    );
  }

  @Post("admin/:userId/awayranges")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async createAwayRangeAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: CreateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.createAwayRange(userId, body),
    );
  }

  @Patch("admin/:userId/awayranges/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async updateAwayRangeAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateAwayRangeDto,
  ): Promise<UserAwayRangeDto> {
    return new UserAwayRangeDto(
      await this.userService.updateAwayRange(userId, id, body),
    );
  }

  @Delete("admin/:userId/awayranges/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async deleteAwayRangeAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userService.deleteAwayRange(userId, id);
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

  @Post("friends/:targetUserId")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Send a friend request" })
  @ApiOkResponse({ description: "Friend request is now pending" })
  async requestFriend(
    @Param("targetUserId", ParseIntPipe) targetUserId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.userService.createFriendRequest(req.user.sub, targetUserId);
    this.posthog.capture({
      event: AnalyticsEvent.FriendRequestSent,
      distinctId: String(req.user.sub),
      properties: {
        targetUserId,
      },
    });
  }

  @Patch("friends/:requesterId/accept")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Accept a pending friend request" })
  @ApiOkResponse({ description: "Friend request accepted" })
  async acceptFriendRequest(
    @Param("requesterId", ParseIntPipe) requesterId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.userService.updateFriendRequestStatus(
      requesterId,
      req.user.sub,
      FriendStatus.Accepted,
    );
    this.posthog.capture({
      event: AnalyticsEvent.FriendRequestAccepted,
      distinctId: String(req.user.sub),
      properties: {
        requesterId,
      },
    });
  }

  @Patch("friends/:requesterId/decline")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Decline a pending friend request" })
  @ApiOkResponse({ description: "Friend request declined" })
  async declineFriendRequest(
    @Param("requesterId", ParseIntPipe) requesterId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.userService.updateFriendRequestStatus(
      requesterId,
      req.user.sub,
      FriendStatus.Declined,
    );
  }

  @Delete("friends/:targetUserId")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Cancel a request or remove an existing friend" })
  @ApiOkResponse({ description: "Relationship removed" })
  async removeFriend(
    @Param("targetUserId", ParseIntPipe) targetUserId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.userService.removeFriend(req.user.sub, targetUserId);
    this.posthog.capture({
      event: AnalyticsEvent.FriendRemoved,
      distinctId: String(req.user.sub),
      properties: {
        targetUserId,
      },
    });
  }

  @Get("friends/requests/received")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Requests other users sent to me (pending)" })
  @ApiOkResponse({ type: [ProfileDto] })
  async listReceivedRequests(
    @Request() req: JwtRequest,
  ): Promise<ProfileDto[]> {
    return (
      await this.userService.findPendingRequests(req.user.sub, "received")
    ).map((user) => new ProfileDto(user));
  }

  @Get("friends/requests/sent")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Requests I sent that are still pending" })
  @ApiOkResponse({ type: [ProfileDto] })
  async listSentRequests(@Request() req: JwtRequest): Promise<ProfileDto[]> {
    return (
      await this.userService.findPendingRequests(req.user.sub, "sent")
    ).map((user) => new ProfileDto(user));
  }

  @Get("myfriendrelationship/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FriendStatusDto })
  async myFriendRelationship(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<FriendStatusDto> {
    return new FriendStatusDto(
      await this.userService.getRelationshipStatus(req.user.sub, +id),
    );
  }

  @Get("listfriends/:id")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async listFriends(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ProfileDto[]> {
    if (!req.user) {
      throw new UnauthorizedException("User not found");
    }
    return (await this.userService.findFriends(id)).map(
      (user) => new ProfileDto(user),
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
    const user = await this.userService.findOne(id, {
      contractEvents: true,
      referredBy: true,
      referredByCampaign: true,
      referredByInvite: { invitingUser: true },
      referredByShareUrl: true,
      city: true,
      tags: true,
      communities: true,
      leaderOf: true,
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return new UserAdminDetailDto(user);
  }

  @Patch("userdetail/:id/roles")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAdminDetailDto })
  async updateUserRolesAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateUserRolesAdminDto,
  ): Promise<UserAdminDetailDto> {
    return new UserAdminDetailDto(
      await this.userService.updateRolesAdmin(id, body),
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

  @Post("createTag")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async createTagAdmin(@Body() body: CreateTagDto): Promise<TagDto> {
    return new TagDto(await this.userService.createTag(body));
  }

  @Get("tags")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TagDto] })
  async getTagsAdmin(): Promise<TagDto[]> {
    return (await this.userService.findAllTags()).map((tag) => new TagDto(tag));
  }

  @Get("tag-summaries")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TagSummaryDto] })
  async getTagSummariesAdmin(): Promise<TagSummaryDto[]> {
    return (await this.userService.findAllTagSummaries()).map(
      (tag) => new TagSummaryDto(tag),
    );
  }

  @Post("tags/:tagId/addUser")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async addUserToTagAdmin(
    @Param("tagId") tagId: string,
    @Body() body: AddUserToTagDto,
  ): Promise<TagDto> {
    return new TagDto(await this.userService.addUserToTag(tagId, body.userId));
  }

  @Post("tags/:tagId/removeUser")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async removeUserFromTagAdmin(
    @Param("tagId") tagId: string,
    @Body() body: AddUserToTagDto,
  ): Promise<TagDto> {
    return new TagDto(
      await this.userService.removeUserFromTag(tagId, body.userId),
    );
  }

  @Post("tags/:tagId/update")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async updateTagAdmin(
    @Param("tagId") tagId: string,
    @Body() body: CreateTagDto,
  ): Promise<TagDto> {
    return new TagDto(await this.userService.updateTag(tagId, body));
  }

  @Delete("tags/:tagId")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteTagAdmin(@Param("tagId") tagId: string): Promise<void> {
    await this.userService.deleteTag(tagId);
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

  @Get("signupSocialProof")
  @Public()
  @ApiOperation({
    summary: "Member avatars for signup social proof (optional referral code)",
  })
  @ApiQuery({
    name: "code",
    required: false,
    description: "Referral or invite code to prefer inviter friends",
  })
  @ApiOkResponse({ type: SignupSocialProofDto })
  async signupSocialProof(
    @Query("code") code?: string,
  ): Promise<SignupSocialProofDto> {
    return new SignupSocialProofDto(
      await this.userService.getSignupSocialProof(code),
    );
  }

  @Get("referrerProfile/:code")
  @Public()
  @ApiOkResponse({ type: ReferrerProfileDto })
  async referrerProfile(
    @Param("code") code: string,
  ): Promise<ReferrerProfileDto> {
    const referrer = await this.userService.resolveReferrer(code);
    if (!referrer) {
      throw new NotFoundException("Referrer not found");
    }
    return new ReferrerProfileDto(referrer);
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
        communityId: invite.communityId ?? invite.community?.id,
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
        communityId: invite.communityId ?? invite.community?.id,
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
        communityId: invite.communityId ?? invite.community?.id,
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
  ): Promise<OnetimeInviteDto[]> {
    return (await this.userService.findOnetimeInvites(communityId)).map(
      (invite) => new OnetimeInviteDto(invite),
    );
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

  @Post("groupAssignment/join")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async joinGroupAssignment(@Request() req: JwtRequest): Promise<void> {
    await this.userService.joinGroupAssignment(req.user.sub);
  }

  @Post("groupAssignment/leave")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async leaveGroupAssignment(@Request() req: JwtRequest): Promise<void> {
    await this.userService.leaveGroupAssignment(req.user.sub);
  }

  @Post("groupAssignment/members")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async getGroupAssignmentMembersAdmin(): Promise<UserDto[]> {
    return (await this.userService.findGroupAssignmentMembers()).map(
      (user) => new UserDto(user),
    );
  }

  @Post("groupAssignment/assign")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async assignGroupsAdmin(@Body() body: AssignGroupsDto): Promise<void> {
    await this.userService.assignGroupsAdmin(body);
  }

  @Post("registerDevice")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserDeviceDto })
  async registerDevice(
    @Request() req: JwtRequest,
    @Body() body: RegisterDeviceDto,
  ): Promise<UserDeviceDto> {
    const id = await this.userService.registerDevice(req.user.sub, body);
    return new UserDeviceDto(id);
  }

  @Post("sendPushNotification")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: PushDto })
  async sendPushNotificationAdmin(
    @Body() body: TestPushNotificationDto,
  ): Promise<PushDto> {
    return new PushDto(
      await this.userService.testPushNotification(body.userId, body.message),
    );
  }

  @Post("registerLiveActivityPushToStartToken")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserDeviceDto })
  async registerLiveActivityPushToStartToken(
    @Request() req: JwtRequest,
    @Body() body: RegisterLiveActivityPushToStartTokenDto,
  ): Promise<UserDeviceDto> {
    const id = await this.userService.registerLiveActivityPushToStartToken(
      req.user.sub,
      body,
    );
    return new UserDeviceDto(id);
  }

  @Post("registerLiveActivityUpdateToken")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async registerLiveActivityUpdateToken(
    @Request() req: JwtRequest,
    @Body() body: RegisterLiveActivityUpdateTokenDto,
  ): Promise<void> {
    await this.userService.registerLiveActivityUpdateToken(req.user.sub, body);
  }

  @Post("requestAccountDeletion")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async requestAccountDeletion(@Request() req: JwtRequest): Promise<void> {
    R.unwrap(await this.userService.requestAccountDeletion(req.user.sub));
  }
}
