import {
  Controller,
  Get,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
  UnauthorizedException,
  Post,
  Patch,
  Delete,
  Body,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { UserService } from './user.service';
import {
  FriendStatusDto,
  OnboardingDto,
  ProfileDto,
  UpdateProfileDto,
  UserDto,
  SavePushTokenDto,
  RemovePushTokenDto
} from './user.dto';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { FriendStatus } from './friend.entity';
import { City } from 'src/geo/city.entity';
import { PrefillUserDto } from './prefill-user.dto';

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
    return {
      email: profile.email,
      name: profile.name,
      admin: profile.admin,
      id: profile.id,
      profileDescription: profile.profileDescription,
      profilePicture: profile.profilePicture,
    };
  }

  @Post('onboarding')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  async onboarding(
    @Request() req: JwtRequest,
    @Body() body: OnboardingDto,
  ): Promise<ProfileDto> {
    await this.userService.onboarding(req.user.sub, body);
    const profile = await this.userService.findOne(req.user.sub);
    console.log('profile', profile);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile;
  }

  @Post('update')
  @UseGuards(AuthGuard)
  update(
    @Body() updateActionDto: UpdateProfileDto,
    @Request() req: JwtRequest,
  ) {
    return this.userService.update(req.user.sub, updateActionDto);
  }

  @Get('mylocation')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: City })
  async myLocation(@Request() req: JwtRequest): Promise<City> {
    console.log('myLocation', req.user.sub);
    console.log(await this.userService.getUserLocation(req.user.sub));
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
  @ApiOkResponse({ type: [UserDto] })
  async listReceivedRequests(@Request() req: JwtRequest): Promise<UserDto[]> {
    return this.userService.findPendingRequests(req.user.sub, 'received');
  }

  @Get('friends/requests/sent')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Requests I sent that are still pending' })
  @ApiOkResponse({ type: [UserDto] })
  async listSentRequests(@Request() req: JwtRequest): Promise<UserDto[]> {
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
    return { status };
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
  @ApiOkResponse({ type: [UserDto] })
  async listFriends(
    @Request() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserDto[]> {
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

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProfileDto | null> {
    return this.userService.findOne(id);
  }

  @Post('pushToken')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Save push notification token for a user' })
  @ApiBody({ type: SavePushTokenDto })
  async savePushToken(@Request() req: JwtRequest, @Body() body: SavePushTokenDto) {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    await this.userService.savePushToken(req.user.sub, body.token);
    return { success: true };
  }

  @Post('removePushToken')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Remove push notification token for a user' })
  @ApiBody({ type: RemovePushTokenDto })
  async removePushToken(@Body() body: RemovePushTokenDto) {
    await this.userService.removePushToken(body.userId, body.token);
    return { success: true };
  }
}
