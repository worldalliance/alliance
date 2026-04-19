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
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { City } from 'src/geo/city.entity';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { JwtRequest } from 'src/auth/guards/jwtreq';
import { Public } from '../auth/public.decorator';
import { FriendStatus } from './entities/friend.entity';
import { PrefillUserDto } from './prefill-user.dto';
import {
  AssignGroupsDto,
  FriendStatusDto,
  ProfileDto,
  ProfileDtoWithFriends,
  SignupSocialProofDto,
  UpdateProfileDto,
  UserCityCountDto,
  UserDto,
} from './dto/user.dto';
import { UserService } from './user.service';
import { AddUserToTagDto, CreateTagDto, TagDto } from './dto/tag.dto';
import {
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  RequestOnetimeInviteDto,
} from './dto/invite.dto';
import {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from './dto/away-range.dto';
import { CommunityLeaderGuard } from 'src/auth/guards/communityleader.guard';
import {
  RegisterDeviceDto,
  RegisterLiveActivityPushToStartTokenDto,
  RegisterLiveActivityUpdateTokenDto,
  TestPushNotificationDto,
  UserDeviceDto,
} from './dto/device.dto';
import { Push } from 'src/push/push.entity';

class VerifyEmailBody {
  @IsString()
  @IsNotEmpty()
  token: string;
}

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
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

  @Post('awayranges')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async createAwayRange(
    @Request() req: JwtRequest,
    @Body() body: CreateAwayRangeDto,
  ) {
    return this.userService.createAwayRange(req.user.sub, body);
  }

  @Get('awayranges')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [UserAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRanges(@Request() req: JwtRequest) {
    return this.userService.getAwayRanges(req.user.sub);
  }

  @Delete('awayranges/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: String })
  @ApiUnauthorizedResponse()
  async deleteAwayRange(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.userService.deleteAwayRange(req.user.sub, id);
    return { success: true };
  }

  @Patch('awayranges/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async updateAwayRange(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAwayRangeDto,
  ) {
    return this.userService.updateAwayRange(req.user.sub, id, body);
  }

  @Get('awayranges/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UserAwayRangeDto] })
  @ApiUnauthorizedResponse()
  async getAwayRangeForUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getAwayRanges(id);
  }

  @Post('update')
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

  @Get('mylocation')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: City })
  async myLocation(@Request() req: JwtRequest): Promise<City | undefined> {
    return this.userService.getUserLocation(req.user.sub);
  }

  @Post('friends/:targetUserId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiOkResponse({ description: 'Friend request is now pending' })
  async requestFriend(
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @Request() req: JwtRequest,
  ) {
    return this.userService.createFriendRequest(req.user.sub, targetUserId);
  }

  @Patch('friends/:requesterId/accept')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Accept a pending friend request' })
  @ApiOkResponse({ description: 'Friend request accepted' })
  async acceptFriendRequest(
    @Param('requesterId', ParseIntPipe) requesterId: number,
    @Request() req: JwtRequest,
  ) {
    return this.userService.updateFriendRequestStatus(
      requesterId,
      req.user.sub,
      FriendStatus.Accepted,
    );
  }

  @Patch('friends/:requesterId/decline')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Decline a pending friend request' })
  @ApiOkResponse({ description: 'Friend request declined' })
  async declineFriendRequest(
    @Param('requesterId', ParseIntPipe) requesterId: number,
    @Request() req: JwtRequest,
  ) {
    return this.userService.updateFriendRequestStatus(
      requesterId,
      req.user.sub,
      FriendStatus.Declined,
    );
  }

  @Delete('friends/:targetUserId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Cancel a request or remove an existing friend' })
  @ApiOkResponse({ description: 'Relationship removed' })
  async removeFriend(
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @Request() req: JwtRequest,
  ) {
    return this.userService.removeFriend(req.user.sub, targetUserId);
  }

  @Get('friends/requests/received')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Requests other users sent to me (pending)' })
  @ApiOkResponse({ type: [ProfileDto] })
  async listReceivedRequests(
    @Request() req: JwtRequest,
  ): Promise<ProfileDto[]> {
    return this.userService.findPendingRequests(req.user.sub, 'received');
  }

  @Get('friends/requests/sent')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Requests I sent that are still pending' })
  @ApiOkResponse({ type: [ProfileDto] })
  async listSentRequests(@Request() req: JwtRequest): Promise<ProfileDto[]> {
    return this.userService.findPendingRequests(req.user.sub, 'sent');
  }

  @Get('myfriendrelationship/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: FriendStatusDto })
  async myFriendRelationship(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FriendStatusDto> {
    const status = await this.userService.getRelationshipStatus(
      req.user.sub,
      +id,
    );
    return status;
  }

  @Get('prefill/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  async prefill(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PrefillUserDto> {
    const user = await this.userService.findOnePrefill(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      city: user.city,
    };
  }

  @Get('listfriends/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async listFriends(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProfileDto[]> {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.userService.findFriends(id);
  }

  @Get('listMessageableUsers')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async listMessageableUsers(
    @Request() req: JwtRequest,
  ): Promise<ProfileDto[]> {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return this.userService.findMessageableUsers(req.user.sub);
  }

  @Get('countreferred/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: Number })
  @ApiOperation({ summary: 'Count the number of friends a user has referred' })
  async countReferred(@Param('id', ParseIntPipe) id: number): Promise<number> {
    return this.userService.countReferred(id);
  }

  @Get('list')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async list(): Promise<UserDto[]> {
    return (
      await this.userService.findAll({ contractEvents: true, referredBy: true })
    ).map((user) => new UserDto(user));
  }

  @Get('list-graph')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listForGraph(): Promise<UserDto[]> {
    return (
      await this.userService.findAll({ contractEvents: true, referredBy: true, communities: true, tags: true })
    ).map((user) => new UserDto(user));
  }

  @Get('cityCounts')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UserCityCountDto] })
  async cityCounts(): Promise<UserCityCountDto[]> {
    return this.userService.getUserCityCounts();
  }

  @Get('userdetail/:id')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto })
  async userDetail(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
    const user = await this.userService.findOne(id, {
      contractEvents: true,
      referredBy: true,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return new UserDto(user);
  }

  @Get('list-public')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listPublic(): Promise<UserDto[]> {
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new UserDto(user),
    );
  }

  @Get('members')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async members(): Promise<ProfileDto[]> {
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get('members-public')
  @Public()
  @ApiOkResponse({ type: [ProfileDto] })
  async membersPublic(): Promise<ProfileDto[]> {
    return (await this.userService.findAllMembersPublic()).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get('membersWithFriends')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDtoWithFriends] })
  async membersWithFriends(
    @Query('requireSignedContract', new DefaultValuePipe(false), ParseBoolPipe)
    requireSignedContract: boolean,
  ): Promise<ProfileDtoWithFriends[]> {
    const users = await this.userService.findAllWithFriendRequests();

    if (requireSignedContract) {
      return users
        .filter((user) => user.hasActiveContract)
        .map((user) => new ProfileDtoWithFriends(user));
    } else {
      return users.map((user) => new ProfileDtoWithFriends(user));
    }
  }

  @Get('myprofile')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  async myProfile(@Request() req: JwtRequest): Promise<ProfileDto | null> {
    const user = await this.userService.findOne(req.user.sub, {
      contractEvents: true,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return new ProfileDto(user);
  }

  @Get('count')
  @ApiOkResponse({ type: Number })
  async count(): Promise<number> {
    return this.userService.count();
  }

  @Get('slug/:id')
  @Public()
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProfileDto | null> {
    const user = await this.userService.findOne(id, { contractEvents: true });
    return user ? new ProfileDto(user) : null;
  }

  @Post('verifyEmail')
  @Public()
  @ApiOkResponse()
  async verifyEmail(@Body() body: VerifyEmailBody) {
    return this.userService.verifyEmail(body.token);
  }

  @Post('nmembers')
  @Public()
  @ApiOkResponse({ type: Number })
  async nmembers() {
    return this.userService.signedMembersCount();
  }

  @Post('createTag')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async createTag(@Body() body: CreateTagDto) {
    return new TagDto(await this.userService.createTag(body));
  }

  @Get('tags')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TagDto] })
  async getTags() {
    return (await this.userService.findAllTags()).map((tag) => new TagDto(tag));
  }

  @Post('tags/:tagId/addUser')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async addUserToTag(
    @Param('tagId') tagId: string,
    @Body() body: AddUserToTagDto,
  ) {
    return new TagDto(await this.userService.addUserToTag(tagId, body.userId));
  }

  @Post('tags/:tagId/removeUser')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async removeUserFromTag(
    @Param('tagId') tagId: string,
    @Body() body: AddUserToTagDto,
  ) {
    return new TagDto(
      await this.userService.removeUserFromTag(tagId, body.userId),
    );
  }

  @Post('tags/:tagId/update')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async updateTag(@Param('tagId') tagId: string, @Body() body: CreateTagDto) {
    return new TagDto(await this.userService.updateTag(tagId, body));
  }

  @Delete('tags/:tagId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteTag(@Param('tagId') tagId: string) {
    await this.userService.deleteTag(tagId);
  }

  @Get('signupSocialProof')
  @Public()
  @ApiOperation({ summary: 'Member avatars for signup social proof (optional referral code)' })
  @ApiQuery({ name: 'code', required: false, description: 'Referral or invite code to prefer inviter friends' })
  @ApiOkResponse({ type: SignupSocialProofDto })
  async signupSocialProof(@Query('code') code?: string): Promise<SignupSocialProofDto> {
    return this.userService.getSignupSocialProof(code);
  }

  @Get('referrerProfile/:code')
  @Public()
  @ApiOkResponse({ type: ProfileDto })
  async referrerProfile(
    @Param('code') code: string,
  ): Promise<ProfileDto | null> {
    const invite = await this.userService.findInviteByCode(code);
    if (invite) {
      return new ProfileDto(invite.invitingUser);
    }
    const user = await this.userService.findOneByReferralCode(code);
    if (!user) {
      throw new NotFoundException('Referrer not found');
    }
    return new ProfileDto(user);
  }

  @Get('onetimeInvite/:code')
  @Public()
  @ApiOkResponse({ type: OnetimeInviteDto })
  async onetimeInvite(@Param('code') code: string) {
    return this.userService.findInviteByCode(code);
  }

  @Post('onetimeInvite/request')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async requestOnetimeInvite(
    @Body() body: RequestOnetimeInviteDto,
    @Request() req: JwtRequest,
  ) {
    return new OnetimeInviteDto(
      await this.userService.requestOnetimeInvite(body, req.user.sub),
    );
  }

  @Post('onetimeInvite/:inviteId/approve')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async approveOnetimeInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    return new OnetimeInviteDto(
      await this.userService.approveOnetimeInviteRequest(
        inviteId,
        req.user.sub,
      ),
    );
  }

  @Post('onetimeInvite/:inviteId/reject')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse()
  async rejectOnetimeInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    return this.userService.rejectOnetimeInviteRequest(inviteId, req.user.sub);
  }

  @Post('onetimeInvite/create')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async createOnetimeInvite(
    @Body() body: CreateOnetimeInviteDto,
    @Request() req: JwtRequest,
  ) {
    return new OnetimeInviteDto(
      await this.userService.createOnetimeInvite(body, req.user.sub),
    );
  }

  @Delete('onetimeInvites/:inviteId')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async deleteOnetimeInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    await this.userService.deleteOnetimeInvite(inviteId, req.user.sub);
  }

  @Get('onetimeInvites')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [OnetimeInviteDto] })
  async getOnetimeInvites() {
    return (await this.userService.findAllOnetimeInvites()).map(
      (invite) => new OnetimeInviteDto(invite),
    );
  }

  @Get('onetimeInvites/overview')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: OnetimeInviteDto, isArray: true })
  async getOnetimeInvitesOverview(
    @Request() req: JwtRequest,
  ): Promise<OnetimeInviteDto[]> {
    return (
      await this.userService.findOnetimeInvitesOverviewForUser(req.user.sub)
    ).map((invite) => new OnetimeInviteDto(invite));
  }

  @Get('onetimeInvites/:communityId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: [OnetimeInviteDto] })
  async getOnetimeInvitesByCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
  ) {
    return (await this.userService.findOnetimeInvites(communityId)).map(
      (invite) => new OnetimeInviteDto(invite),
    );
  }

  @Get('onetimeInvites/:communityId/my')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [OnetimeInviteDto] })
  async getOnetimeInvitesByRequester(
    @Request() req: JwtRequest,
    @Param('communityId', ParseIntPipe) communityId: number,
  ) {
    return this.userService.findOnetimeInvitesByRequester(
      req.user.sub,
      communityId,
    );
  }

  @Post('groupAssignment/join')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async joinGroupAssignment(@Request() req: JwtRequest) {
    await this.userService.joinGroupAssignment(req.user.sub);
  }

  @Post('groupAssignment/leave')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async leaveGroupAssignment(@Request() req: JwtRequest) {
    await this.userService.leaveGroupAssignment(req.user.sub);
  }

  @Post('groupAssignment/members')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async getGroupAssignmentMembers(): Promise<UserDto[]> {
    return (await this.userService.findGroupAssignmentMembers()).map(
      (user) => new UserDto(user),
    );
  }

  @Post('groupAssignment/assign')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async assignGroupsAdmin(@Body() body: AssignGroupsDto) {
    await this.userService.assignGroupsAdmin(body);
  }

  @Post('registerDevice')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserDeviceDto })
  async registerDevice(
    @Request() req: JwtRequest,
    @Body() body: RegisterDeviceDto,
  ) {
    const device = await this.userService.registerDevice(req.user.sub, body);
    return { id: device.id };
  }

  @Post('sendPushNotification')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: Push })
  async sendPushNotification(@Body() body: TestPushNotificationDto) {
    return this.userService.testPushNotification(body.userId, body.message);
  }

  @Post('registerLiveActivityPushToStartToken')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserDeviceDto })
  async registerLiveActivityPushToStartToken(
    @Request() req: JwtRequest,
    @Body() body: RegisterLiveActivityPushToStartTokenDto,
  ): Promise<UserDeviceDto> {
    return this.userService.registerLiveActivityPushToStartToken(
      req.user.sub,
      body,
    );
  }

  @Post('registerLiveActivityUpdateToken')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async registerLiveActivityUpdateToken(
    @Request() req: JwtRequest,
    @Body() body: RegisterLiveActivityUpdateTokenDto,
  ): Promise<void> {
    await this.userService.registerLiveActivityUpdateToken(req.user.sub, body);
  }

  @Post('requestAccountDeletion')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async requestAccountDeletion(@Request() req: JwtRequest) {
    await this.userService.requestAccountDeletion(req.user.sub);
  }
}
