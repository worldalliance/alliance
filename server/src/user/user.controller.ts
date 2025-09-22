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
import { FriendStatus } from './friend.entity';
import { PrefillUserDto } from './prefill-user.dto';
import {
  FriendStatusDto,
  OnboardingDto,
  ProfileDto,
  UpdateProfileDto,
  userToDto,
} from './user.dto';
import { User } from './user.entity';
import { UserService } from './user.service';

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

  @Get('members')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async members(): Promise<ProfileDto[]> {
    return (await this.userService.findAll()).map(
      (user) => new ProfileDto(user),
    );
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
}
