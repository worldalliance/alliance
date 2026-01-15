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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { City } from 'src/geo/city.entity';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { Public } from '../auth/public.decorator';
import { FriendStatus } from './entities/friend.entity';
import { PrefillUserDto } from './prefill-user.dto';
import {
  FriendStatusDto,
  OnboardingDto,
  ProfileDto,
  ProfileDtoWithFriends,
  UpdateProfileDto,
  UserDto,
  userToDto,
} from './dto/user.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { AddUserToTagDto, CreateTagDto, TagDto } from './dto/tag.dto';
import { CommunityMemberContactInfoDto } from './dto/user-action-relations.dto';
import {
  CommunityInviteDto,
  CreateCommunityInviteDto,
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  RequestOnetimeInviteDto,
} from './dto/invite.dto';
import {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from './dto/away-range.dto';
import {
  CommunityDto,
  CommunityMemberDto,
  CreateCommunityDto,
  UpdateCommunityDto,
} from './community.dto';
import { CommunityLeaderGuard } from 'src/auth/guards/communityleader.guard';
import {
  RegisterDeviceDto,
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

  @Post('onboarding')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  async onboarding(@Request() req: JwtRequest, @Body() body: OnboardingDto) {
    await this.userService.onboarding(req.user.sub, body);
  }

  @Post('signcontract')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: String })
  @ApiUnauthorizedResponse()
  async signContract(@Request() req: JwtRequest) {
    return this.userService.signContract(req.user.sub);
  }

  @Post('suspendcontract')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: String })
  @ApiUnauthorizedResponse()
  async suspendContract(@Request() req: JwtRequest) {
    return this.userService.suspendContract(req.user.sub);
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
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new UserDto(user),
    );
  }

  @Get('list-public')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listPublic(): Promise<UserDto[]> {
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new UserDto(user),
    );
  }

  // @Get('action-relations')
  // @UseGuards(AdminGuard)
  // @ApiOkResponse({ type: UserActionRelationsResponseDto })
  // async actionRelations(): Promise<UserActionRelationsResponseDto> {
  //   return this.actionsService.getUserActionRelations();
  // }

  @Get('members')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async members(): Promise<ProfileDto[]> {
    return (await this.userService.findAll()).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get('members-public')
  @UseGuards(AuthGuard)
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
    return userToDto(
      await this.userService.findOne(id, { contractEvents: true }),
    );
  }

  @Post('verifyEmail')
  @Public()
  @ApiOkResponse({ type: User })
  async verifyEmail(@Body() body: VerifyEmailBody) {
    return this.userService.verifyEmail(body.token);
  }

  @Post('communities')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async createCommunity(@Body() body: CreateCommunityDto) {
    return new CommunityDto(await this.userService.createCommunity(body));
  }

  @Get('communities')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [CommunityDto] })
  async getCommunities() {
    return (await this.userService.findAllCommunities()).map(
      (community) => new CommunityDto(community),
    );
  }

  @Patch('communities/:communityId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: CommunityDto })
  async updateCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: UpdateCommunityDto,
    @Request() req: JwtRequest,
  ) {
    return new CommunityDto(
      await this.userService.updateCommunity(communityId, body, req.user.sub),
    );
  }

  @Delete('communities/:communityId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
  ) {
    await this.userService.deleteCommunity(communityId);
  }

  @Post('communities/:communityId/addMember')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async addMemberToCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ) {
    return new CommunityDto(
      await this.userService.addUserToCommunity(communityId, body.userId),
    );
  }

  @Post('communities/:communityId/removeMember')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async removeMemberFromCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ) {
    return new CommunityDto(
      await this.userService.removeUserFromCommunity(communityId, body.userId),
    );
  }

  @Post('communities/:communityId/addLeader')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async addLeaderToCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ) {
    return new CommunityDto(
      await this.userService.addLeaderToCommunity(communityId, body.userId),
    );
  }

  @Post('communities/:communityId/removeLeader')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityDto })
  async removeLeaderFromCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() body: CommunityMemberDto,
  ) {
    return new CommunityDto(
      await this.userService.removeLeaderFromCommunity(
        communityId,
        body.userId,
      ),
    );
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
    return this.userService.requestOnetimeInvite(body, req.user.sub);
  }

  @Post('onetimeInvite/:inviteId/approve')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async approveOnetimeInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    return new OnetimeInviteDto(
      await this.userService.approveOnetimeInvite(inviteId, req.user.sub),
    );
  }

  @Post('onetimeInvite/:inviteId/reject')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse()
  async rejectOnetimeInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    return this.userService.rejectOnetimeInvite(inviteId, req.user.sub);
  }

  @Post('onetimeInvite/create')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async createOnetimeInvite(
    @Body() body: CreateOnetimeInviteDto,
    @Request() req: JwtRequest,
  ) {
    return new OnetimeInviteDto(
      await this.userService.createOnetimeInvite(body, req.user.sub),
    );
  }

  @Post('createCommunityInvite')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: CommunityInviteDto })
  async createCommunityInvite(
    @Body() body: CreateCommunityInviteDto,
    @Request() req: JwtRequest,
  ): Promise<CommunityInviteDto> {
    return new CommunityInviteDto(
      await this.userService.createCommunityInvite(body, req.user.sub),
    );
  }

  @Get('communityInvites/:communityId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: [CommunityInviteDto] })
  async getCommunityInvites(
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityInviteDto[]> {
    return this.userService.findCommunityInvites(communityId);
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

  @Delete('communityInvites/:inviteId')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse()
  async deleteCommunityInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    await this.userService.deleteCommunityInvite(inviteId, req.user.sub);
  }

  @Get('communityInvites')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [CommunityInviteDto] })
  async getCommunityInvitesForUser(@Request() req: JwtRequest) {
    return this.userService.findCommunityInvitesForUser(req.user.sub);
  }

  @Get('onetimeInvites')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [OnetimeInviteDto] })
  async getOnetimeInvites() {
    return (await this.userService.findAllOnetimeInvites()).map(
      (invite) => new OnetimeInviteDto(invite),
    );
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

  @Get('myCommunity')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CommunityDto })
  async getMyCommunity(@Request() req: JwtRequest) {
    const community = await this.userService.findUserCommunity(req.user.sub);
    if (!community) {
      return null;
    }
    return new CommunityDto(community);
  }

  // @Get('communityMemberInfo')
  // @UseGuards(AuthGuard)
  // @ApiOkResponse({ type: CommunityUserInfoDto })
  // async getCommunityMemberInfo(@Request() req: JwtRequest) {
  //   return this.actionsService.getMemberInfo(req.user.sub);
  // }

  @Get('communityMemberContactInfo')
  @UseGuards(CommunityLeaderGuard)
  @ApiOkResponse({ type: CommunityMemberContactInfoDto, isArray: true })
  async getCommunityMemberContactInfo(@Request() req: JwtRequest) {
    return this.userService.getMemberContactInfo(req.user.sub);
  }

  @Get('communityMemberContactInfo/:communityId')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityMemberContactInfoDto, isArray: true })
  async getCommunityMemberContactInfoAdmin(
    @Param('communityId', ParseIntPipe) communityId: number,
  ) {
    return this.userService.getMemberContactInfoByCommunityId(communityId);
  }

  @Get('memberContactInfo')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: CommunityMemberContactInfoDto, isArray: true })
  async getAllMemberContactInfo() {
    return this.userService.getAllMemberContactInfo();
  }

  @Post('communityInvites/:inviteId/accept')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async acceptCommunityInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    await this.userService.acceptCommunityInvite(inviteId, req.user.sub);
  }

  @Post('communityInvites/:inviteId/reject')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async rejectCommunityInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Request() req: JwtRequest,
  ) {
    await this.userService.rejectCommunityInvite(inviteId, req.user.sub);
  }

  @Post('communities/:communityId/leave')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async leaveCommunity(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Request() req: JwtRequest,
  ) {
    await this.userService.leaveCommunity(communityId, req.user.sub);
  }

  @Post('registerDevice')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserDeviceDto })
  async registerDevice(
    @Request() req: JwtRequest,
    @Body() body: RegisterDeviceDto,
  ) {
    const device = await this.userService.registerDevice(req.user.sub, body);
    console.log('device: ', device);
    return { id: device.id };
  }

  @Post('sendPushNotification')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: Push })
  async sendPushNotification(@Body() body: TestPushNotificationDto) {
    return this.userService.testPushNotification(body.userId, body.message);
  }
}
