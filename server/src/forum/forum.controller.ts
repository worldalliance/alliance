import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { JwtPayload, JwtRequest } from "src/auth/guards/jwtreq";
import { PosthogService } from "src/posthog/posthog.service";
import { AdminGuard } from "../auth/guards/admin.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AuthOptionalGuard } from "../auth/guards/authoptional.guard";
import { ReqUser } from "../auth/user.decorator";
import {
  CommentDto,
  CreateCommentDto,
  UpdateCommentDto,
  UserCommentDto,
} from "./dto/comment.dto";
import {
  CreatePostDto,
  PostDto,
  UpdatePostAuthorsDto,
  UpdatePostDto,
  UpdatePostExpertsDto,
} from "./dto/post.dto";
import { ForumService } from "./forum.service";

@ApiTags("forum")
@Controller("forum")
export class ForumController {
  constructor(
    private readonly forumService: ForumService,
    private readonly posthog: PosthogService,
  ) {}

  @Post("posts")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Create a new forum post" })
  @ApiOkResponse({ type: PostDto })
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @ReqUser() user: JwtPayload,
  ): Promise<PostDto> {
    const post = await this.forumService.createPost(createPostDto, user.sub);
    this.posthog.capture({
      event: AnalyticsEvent.ForumPostCreated,
      distinctId: String(user.sub),
      properties: {
        postId: post.id,
      },
    });
    return new PostDto({ post, requestingUserId: user.sub });
  }

  @Get("posts")
  @ApiOperation({ summary: "Get all forum posts" })
  @ApiOkResponse({ type: [PostDto] })
  @UseGuards(AuthGuard)
  async findAllPosts(@Request() req: JwtRequest): Promise<PostDto[]> {
    const results = await this.forumService.findAllPosts(req.user.sub);
    return results.map(
      (args) => new PostDto({ ...args, requestingUserId: req.user.sub }),
    );
  }

  @Get("posts/action/:actionId")
  @ApiOperation({ summary: "Get posts for a specific action" })
  @ApiOkResponse({ type: [PostDto] })
  @UseGuards(AuthGuard)
  async findPostsByAction(
    @Param("actionId") actionId: string,
    @Request() req: JwtRequest,
  ): Promise<PostDto[]> {
    return this.forumService
      .findPostsByAction(+actionId)
      .then((posts) =>
        posts.map(
          (post) => new PostDto({ post, requestingUserId: req.user?.sub }),
        ),
      );
  }

  @Get("posts/:id")
  @ApiOperation({ summary: "Get a specific post with its comments" })
  @ApiOkResponse({ type: PostDto })
  @UseGuards(AuthGuard)
  async findOnePost(
    @Param("id") id: string,
    @Request() req: JwtRequest,
  ): Promise<PostDto> {
    return new PostDto({
      post: await this.forumService.findOnePost(+id, req.user?.sub),
      requestingUserId: req.user?.sub,
    });
  }

  @Get("posts/:id/comments")
  @ApiOperation({ summary: "Get all comments for a specific post" })
  @ApiOkResponse({ type: [CommentDto] })
  @UseGuards(AuthOptionalGuard)
  async findCommentsForPost(
    @Param("id") id: string,
    @Request() req: JwtRequest,
  ): Promise<CommentDto[]> {
    return this.forumService
      .findCommentsForPost(+id)
      .then((comments) =>
        comments.map(
          (comment) =>
            new CommentDto(comment, { requestingUserId: req.user?.sub }),
        ),
      );
  }

  @Get("activity/:id/comments")
  @ApiOperation({ summary: "Get all comments for a specific activity" })
  @ApiOkResponse({ type: [CommentDto] })
  @UseGuards(AuthOptionalGuard)
  async findCommentsForActivity(
    @Param("id") id: string,
    @Request() req: JwtRequest,
  ): Promise<CommentDto[]> {
    return this.forumService
      .findCommentsForActivity(+id)
      .then((comments) =>
        comments.map(
          (comment) =>
            new CommentDto(comment, { requestingUserId: req.user?.sub }),
        ),
      );
  }

  @Get("actions/:id/comments")
  @ApiOperation({ summary: "Get all comments for a specific action" })
  @ApiOkResponse({ type: [CommentDto] })
  @UseGuards(AuthOptionalGuard)
  async findCommentsForAction(
    @Param("id") id: string,
    @Request() req: JwtRequest,
  ): Promise<CommentDto[]> {
    return this.forumService
      .findCommentsForAction(+id)
      .then((comments) =>
        comments.map(
          (comment) =>
            new CommentDto(comment, { requestingUserId: req.user?.sub }),
        ),
      );
  }

  @Get("posts/user/:id")
  @ApiOperation({ summary: "Get all posts by a specific user" })
  @ApiOkResponse({ type: [PostDto] })
  @UseGuards(AuthOptionalGuard)
  async findPostsByUser(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<PostDto[]> {
    return this.forumService
      .findPostsByUser(id)
      .then((posts) =>
        posts.map(
          (post) => new PostDto({ post, requestingUserId: req.user?.sub }),
        ),
      );
  }

  @Get("posts/user/:id/comments")
  @ApiOperation({
    summary: "Get all comments by a specific user, excluding activity comments",
  })
  @ApiOkResponse({ type: [UserCommentDto] })
  @UseGuards(AuthOptionalGuard)
  async findCommentsByUser(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<UserCommentDto[]> {
    const userComments = await this.forumService.findCommentsByUser(id);
    return userComments.map(
      (userComment) =>
        new UserCommentDto({ ...userComment, requestingUserId: req.user?.sub }),
    );
  }

  @Get("posts/user/:id/forumComments")
  @ApiOperation({ summary: "Get all forum comments by a specific user" })
  @ApiOkResponse({ type: [CommentDto] })
  @UseGuards(AuthOptionalGuard)
  async findForumCommentsByUser(
    @Param("id", ParseIntPipe) id: number,
    @Request() req: JwtRequest,
  ): Promise<CommentDto[]> {
    return this.forumService
      .findForumCommentsByUser(id)
      .then((comments) =>
        comments.map(
          (comment) =>
            new CommentDto(comment, { requestingUserId: req.user?.sub }),
        ),
      );
  }

  @Patch("posts/:id")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Update a post" })
  @ApiOkResponse({ type: PostDto })
  async updatePost(
    @Param("id", ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @ReqUser() user: JwtPayload,
  ): Promise<PostDto> {
    return new PostDto({
      post: await this.forumService.updatePost(id, updatePostDto, user.sub),
      requestingUserId: user.sub,
    });
  }

  @Delete("posts/:id")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Delete a post" })
  @ApiOkResponse()
  removePost(
    @Param("id", ParseIntPipe) id: number,
    @ReqUser() user: JwtPayload,
  ): Promise<void> {
    return this.forumService.removePost(id, user.sub);
  }

  @Post("comments")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Create a new comment on a post" })
  @ApiOkResponse({ type: CommentDto })
  async createComment(
    @Body() createReplyDto: CreateCommentDto,
    @ReqUser() user: JwtPayload,
  ): Promise<CommentDto> {
    const comment = await this.forumService.createComment(
      createReplyDto,
      user.sub,
    );
    this.posthog.capture({
      event: AnalyticsEvent.ForumCommentCreated,
      distinctId: String(user.sub),
      properties: {
        commentId: comment.id,
      },
    });
    return new CommentDto(comment, { requestingUserId: user.sub });
  }

  @Patch("comments/:id")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Update a comment" })
  @ApiOkResponse({ type: CommentDto })
  async updateComment(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
    @ReqUser() user: JwtPayload,
  ): Promise<CommentDto> {
    return new CommentDto(
      await this.forumService.updateComment(id, updateCommentDto, user.sub),
      { requestingUserId: user.sub },
    );
  }

  @Post("comments/:id/like")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Like a comment" })
  @ApiOkResponse()
  async likeComment(
    @Param("id", ParseIntPipe) id: number,
    @ReqUser() user: JwtPayload,
  ): Promise<void> {
    await this.forumService.likePostOrComment(id, user.sub, false, "comment");
    this.posthog.capture({
      event: AnalyticsEvent.ForumCommentLiked,
      distinctId: String(user.sub),
      properties: {
        commentId: id,
      },
    });
  }

  @Post("comments/:id/unlike")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Unlike a comment" })
  @ApiOkResponse()
  async unlikeComment(
    @Param("id", ParseIntPipe) id: number,
    @ReqUser() user: JwtPayload,
  ): Promise<void> {
    await this.forumService.likePostOrComment(id, user.sub, true, "comment");
    this.posthog.capture({
      event: AnalyticsEvent.ForumCommentUnliked,
      distinctId: String(user.sub),
      properties: {
        commentId: id,
      },
    });
  }

  @Post("posts/:id/like")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Like a post" })
  @ApiOkResponse()
  async likePost(
    @Param("id", ParseIntPipe) id: number,
    @ReqUser() user: JwtPayload,
  ): Promise<void> {
    await this.forumService.likePostOrComment(id, user.sub, false, "post");
    this.posthog.capture({
      event: AnalyticsEvent.ForumPostLiked,
      distinctId: String(user.sub),
      properties: {
        postId: id,
      },
    });
  }

  @Post("posts/:id/unlike")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Unlike a post" })
  @ApiOkResponse()
  async unlikePost(
    @Param("id", ParseIntPipe) id: number,
    @ReqUser() user: JwtPayload,
  ): Promise<void> {
    await this.forumService.likePostOrComment(id, user.sub, true, "post");
    this.posthog.capture({
      event: AnalyticsEvent.ForumPostUnliked,
      distinctId: String(user.sub),
      properties: {
        postId: id,
      },
    });
  }

  @Delete("comments/:id")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Delete a reply" })
  @ApiOkResponse()
  deleteComment(
    @Param("id", ParseIntPipe) id: number,
    @ReqUser() user: JwtPayload,
  ): Promise<void> {
    return this.forumService.deleteReply(+id, user.sub);
  }

  @Get("admin/posts")
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Get all posts for admin management" })
  @ApiOkResponse({ type: [PostDto] })
  async getPostsForAdmin(): Promise<PostDto[]> {
    const posts = await this.forumService.getPostsForAdmin();
    return posts.map((post) => new PostDto({ post }));
  }

  @Patch("admin/posts/:id/experts")
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Update post experts and Q&A mode" })
  @ApiOkResponse({ type: PostDto })
  async updatePostExpertsAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() updatePostExpertsDto: UpdatePostExpertsDto,
  ): Promise<PostDto> {
    const post = await this.forumService.updatePostExperts(
      id,
      updatePostExpertsDto.expertIds,
      updatePostExpertsDto.qaMode,
      updatePostExpertsDto.expertLabel,
      updatePostExpertsDto.notifyForReplies,
      updatePostExpertsDto.showClusterTags,
    );
    return new PostDto({ post });
  }

  @Patch("admin/posts/:id/authors")
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Update post authors" })
  @ApiOkResponse({ type: PostDto })
  async updatePostAuthorsAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() updatePostAuthorsDto: UpdatePostAuthorsDto,
  ): Promise<PostDto> {
    const post = await this.forumService.updatePostAuthors(
      id,
      updatePostAuthorsDto.authorIds,
    );
    return new PostDto({ post });
  }

  @Patch("admin/comments/:id/pin")
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Toggle pin status of a comment" })
  @ApiOkResponse({ type: CommentDto })
  async pinCommentAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<CommentDto> {
    return new CommentDto(await this.forumService.togglePinComment(id));
  }
}
