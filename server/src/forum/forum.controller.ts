import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { CreateReplyDto, UpdateReplyDto } from './dto/reply.dto';
import { AuthGuard, JwtPayload } from '../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Reply } from './entities/reply.entity';
import { ReqUser } from '../auth/user.decorator';
import { PostDto } from './dto/post.dto';
import { ReplyDto } from './dto/reply.dto';

@ApiTags('forum')
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Post('posts')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new forum post' })
  @ApiOkResponse({ type: PostDto })
  createPost(
    @Body() createPostDto: CreatePostDto,
    @ReqUser() user: JwtPayload,
  ): Promise<PostDto> {
    return this.forumService.createPost(createPostDto, user.sub);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get all forum posts' })
  @ApiOkResponse({ type: [PostDto] })
  findAllPosts(): Promise<PostDto[]> {
    return this.forumService.findAllPosts();
  }

  @Get('posts/action/:actionId')
  @ApiOperation({ summary: 'Get posts for a specific action' })
  @ApiOkResponse({ type: [PostDto] })
  findPostsByAction(@Param('actionId') actionId: string): Promise<PostDto[]> {
    return this.forumService.findPostsByAction(+actionId);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get a specific post with its replies' })
  @ApiOkResponse({ type: PostDto })
  findOnePost(@Param('id') id: string): Promise<PostDto> {
    return this.forumService.findOnePost(+id);
  }

  @Patch('posts/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a post' })
  @ApiOkResponse({ type: PostDto })
  updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @ReqUser() user: JwtPayload,
  ): Promise<PostDto> {
    return this.forumService.updatePost(+id, updatePostDto, user.sub);
  }

  @Delete('posts/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a post' })
  @ApiOkResponse()
  removePost(@Param('id') id: string, @ReqUser() user: JwtPayload) {
    return this.forumService.removePost(+id, user.sub);
  }

  @Post('replies')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new reply to a post' })
  @ApiOkResponse({ type: Reply })
  createReply(
    @Body() createReplyDto: CreateReplyDto,
    @ReqUser() user: JwtPayload,
  ) {
    return this.forumService.createReply(createReplyDto, user.sub);
  }

  @Patch('replies/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a reply' })
  @ApiOkResponse({ type: ReplyDto })
  updateReply(
    @Param('id') id: string,
    @Body() updateReplyDto: UpdateReplyDto,
    @ReqUser() user: JwtPayload,
  ): Promise<ReplyDto> {
    return this.forumService.updateReply(+id, updateReplyDto, user.sub);
  }

  @Delete('replies/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a reply' })
  @ApiOkResponse()
  removeReply(@Param('id') id: string, @ReqUser() user: JwtPayload) {
    return this.forumService.removeReply(+id, user.sub);
  }
}
