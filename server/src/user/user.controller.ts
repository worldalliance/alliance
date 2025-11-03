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
  userToDto,
} from './user.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { AddUserToGroupDto, CreateGroupDto, GroupDto } from './group.dto';
import { UserActionRelationsResponseDto } from './dto/user-action-relations.dto';
import { CreateOnetimeInviteDto, OnetimeInviteDto } from './dto/invite.dto';
import { CreateAwayRangeDto, UserAwayRangeDto } from './dto/away-range.dto';

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
    const user = await this.userService.signContract(req.user.sub);
    return user.contractDateSigned;
  }

  @Post('suspendcontract')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: String })
  @ApiUnauthorizedResponse()
  async suspendContract(@Request() req: JwtRequest) {
    const user = await this.userService.suspendContract(req.user.sub);
    return user.contractDateSigned;
  }

  @Post('awayranges')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: UserAwayRangeDto })
  @ApiUnauthorizedResponse()
  async createAwayRange(@Request() req: JwtRequest, @Body() body: CreateAwayRangeDto) {
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
  async deleteAwayRange(@Request() req: JwtRequest, @Param('id', ParseIntPipe) id: number) {
    await this.userService.deleteAwayRange(req.user.sub, id);
    return { success: true };
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

  @Get('countreferred/:id')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: Number })
  @ApiOperation({ summary: 'Count the number of friends a user has referred' })
  async countReferred(@Param('id', ParseIntPipe) id: number): Promise<number> {
    return this.userService.countReferred(id);
  }

  @Get('list')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [User] })
  async list(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get('action-relations')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserActionRelationsResponseDto })
  async actionRelations(): Promise<UserActionRelationsResponseDto> {
    return this.userService.getUserActionRelations();
  }

  @Get('members')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async members(): Promise<ProfileDto[]> {
    return (await this.userService.findAll()).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get('membersWithFriends')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDtoWithFriends] })
  async membersWithFriends(
    @Query('requireSignedContract', new DefaultValuePipe(false), ParseBoolPipe)
    requireSignedContract: boolean,
    @Request() req: JwtRequest,
  ): Promise<ProfileDtoWithFriends[]> {
    const users = await this.userService.findAllWithFriendRequests(
      req.user.sub,
    );

    if (requireSignedContract) {
      return users
        .filter((user) => user.contractDateSigned !== null)
        .map((user) => new ProfileDtoWithFriends(user));
    } else {
      return users.map((user) => new ProfileDtoWithFriends(user));
    }
  }

  @Get('myprofile')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  async myProfile(@Request() req: JwtRequest): Promise<ProfileDto | null> {
    const user = await this.userService.findOne(req.user.sub);
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
    return userToDto(await this.userService.findOne(id));
  }

  @Post('verifyEmail')
  @Public()
  @ApiOkResponse({ type: User })
  async verifyEmail(@Body() body: VerifyEmailBody) {
    return this.userService.verifyEmail(body.token);
  }

  @Post('createGroup')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GroupDto })
  async createGroup(@Body() body: CreateGroupDto) {
    return new GroupDto(await this.userService.createGroup(body));
  }

  @Get('groups')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [GroupDto] })
  async getGroups() {
    return (await this.userService.findAllGroups()).map(
      (group) => new GroupDto(group),
    );
  }

  @Post('groups/:groupId/addUser')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GroupDto })
  async addUserToGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: AddUserToGroupDto,
  ) {
    return new GroupDto(
      await this.userService.addUserToGroup(groupId, body.userId),
    );
  }

  @Post('groups/:groupId/removeUser')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GroupDto })
  async removeUserFromGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: AddUserToGroupDto,
  ) {
    return new GroupDto(
      await this.userService.removeUserFromGroup(groupId, body.userId),
    );
  }

  @Post('groups/:groupId/update')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: GroupDto })
  async updateGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: CreateGroupDto,
  ) {
    return new GroupDto(await this.userService.updateGroup(groupId, body));
  }

  @Delete('groups/:groupId')
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    await this.userService.deleteGroup(groupId);
  }

  @Get('referrerProfile/:code')
  @Public()
  @ApiOkResponse({ type: ProfileDto })
  async referrerProfile(
    @Param('code') code: string,
  ): Promise<ProfileDto | null> {
    const invite = await this.userService.findValidInviteByCode(code);
    if (invite) {
      return new ProfileDto(invite.invitingUser);
    }
    const user = await this.userService.findOneByReferralCode(code);
    if (!user) {
      throw new NotFoundException('Referrer not found');
    }
    return new ProfileDto(user);
  }

  @Get('inviteeName/:code')
  @Public()
  @ApiOkResponse({ type: String })
  async inviteeName(@Param('code') code: string): Promise<string | null> {
    const invite = await this.userService.findValidInviteByCode(code);
    return invite ? invite.invitee : null;
  }

  @Post('createOnetimeInvite')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: OnetimeInviteDto })
  async createOnetimeInvite(@Body() body: CreateOnetimeInviteDto) {
    return this.userService.createOnetimeInvite(body);
  }

  @Get('onetimeInvites')
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [OnetimeInviteDto] })
  async getOnetimeInvites() {
    return this.userService.findAllOnetimeInvites();
  }
}
