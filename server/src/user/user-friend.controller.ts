import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
} from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import { PosthogService } from "src/posthog/posthog.service";
import { AuthGuard } from "../auth/guards/auth.guard";
import { FriendGraphEdgeDto } from "./dto/friend-graph.dto";
import { FriendStatusDto, ProfileDto } from "./dto/user.dto";
import { FriendStatus } from "./entities/friend.entity";
import { UserService } from "./user.service";

@Controller("user")
export class UserFriendController {
  constructor(
    private readonly userService: UserService,
    private readonly posthog: PosthogService,
  ) {}

  @Post("friends/:targetUserId")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Send a friend request" })
  @ApiOkResponse({ type: FriendStatusDto })
  @ApiConflictResponse({ description: "Already friends" })
  async requestFriend(
    @Param("targetUserId", ParseIntPipe) targetUserId: number,
    @Request() req: JwtRequest,
  ): Promise<FriendStatusDto> {
    const rel = await this.userService.createFriendRequest(
      req.user.sub,
      targetUserId,
    );
    this.posthog.capture(
      rel.status === FriendStatus.Accepted
        ? {
            event: AnalyticsEvent.FriendRequestAccepted,
            distinctId: String(req.user.sub),
            properties: { requesterId: targetUserId },
          }
        : {
            event: AnalyticsEvent.FriendRequestSent,
            distinctId: String(req.user.sub),
            properties: { targetUserId },
          },
    );
    return new FriendStatusDto(
      await this.userService.getRelationshipStatus(req.user.sub, targetUserId),
    );
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

  @Get("friends/graphEdges")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [FriendGraphEdgeDto] })
  async getFriendGraphEdgesAdmin(): Promise<FriendGraphEdgeDto[]> {
    return (await this.userService.findFriendGraphEdges()).map(
      (edge) => new FriendGraphEdgeDto(edge),
    );
  }
}
