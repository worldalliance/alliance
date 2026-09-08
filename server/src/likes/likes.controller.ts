import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/guards/auth.guard";
import type { JwtPayload } from "../auth/guards/jwtreq";
import { ReqUser } from "../auth/user.decorator";
import { ProfileDto } from "../user/dto/user.dto";
import { LikesService } from "./likes.service";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 30;

@ApiTags("likes")
@Controller("likes")
@UseGuards(AuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Get("post/:id/users")
  @ApiOperation({ summary: "Get the users who liked a post" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "afterId", required: false, type: Number })
  @ApiOkResponse({ type: [ProfileDto] })
  async getPostUsers(
    @ReqUser() user: JwtPayload,
    @Param("id", ParseIntPipe) id: number,
    @Query("limit", new DefaultValuePipe(DEFAULT_LIMIT), ParseIntPipe)
    limit: number,
    @Query("afterId", new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return (
      await this.likesService.getPostLikers(
        id,
        capLimit(limit),
        afterId,
        user.sub,
      )
    ).map((user) => new ProfileDto(user));
  }

  @Get("comment/:id/users")
  @ApiOperation({ summary: "Get the users who liked a comment" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "afterId", required: false, type: Number })
  @ApiOkResponse({ type: [ProfileDto] })
  async getCommentUsers(
    @ReqUser() user: JwtPayload,
    @Param("id", ParseIntPipe) id: number,
    @Query("limit", new DefaultValuePipe(DEFAULT_LIMIT), ParseIntPipe)
    limit: number,
    @Query("afterId", new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return (
      await this.likesService.getCommentLikers(
        id,
        capLimit(limit),
        afterId,
        user.sub,
      )
    ).map((user) => new ProfileDto(user));
  }

  @Get("activity/:id/users")
  @ApiOperation({ summary: "Get the users who liked an action activity" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "afterId", required: false, type: Number })
  @ApiOkResponse({ type: [ProfileDto] })
  async getActivityUsers(
    @ReqUser() user: JwtPayload,
    @Param("id", ParseIntPipe) id: number,
    @Query("limit", new DefaultValuePipe(DEFAULT_LIMIT), ParseIntPipe)
    limit: number,
    @Query("afterId", new ParseIntPipe({ optional: true })) afterId?: number,
  ): Promise<ProfileDto[]> {
    return (
      await this.likesService.getActivityLikers(
        id,
        capLimit(limit),
        afterId,
        user.sub,
      )
    ).map((user) => new ProfileDto(user));
  }
}

function capLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}
