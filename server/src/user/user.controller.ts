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
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { UserService } from './user.service';
import {
  FriendStatusDto,
  ProfileDto,
  UpdateProfileDto,
  UserDto,
} from './user.dto';
import { AuthGuard, JwtRequest } from '../auth/guards/auth.guard';
import { FriendStatus } from './friend.entity';

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

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProfileDto | null> {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateActionDto: UpdateProfileDto,
    @Request() req: JwtRequest,
  ) {
    if (id !== req.user.sub) {
      throw new UnauthorizedException(); //TODO: move to guard
    }
    return this.userService.update(id, updateActionDto);
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
    const status = await this.userService.myFriendRelationship(
      req.user.sub,
      +id,
    );
    return { status };
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
}
