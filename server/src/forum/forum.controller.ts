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
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { AuthGuard, JwtPayload } from '../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Post as PostEntity } from './entities/post.entity';
import { Reply } from './entities/reply.entity';
import { ReqUser } from '../auth/user.decorator';

@ApiTags('forum')
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Post('posts')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new forum post' })
  @ApiOkResponse({ type: PostEntity })
  createPost(
    @Body() createPostDto: CreatePostDto,
    @ReqUser() user: JwtPayload,
  ) {
    return this.forumService.createPost(createPostDto, user.sub);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get all forum posts' })
  @ApiOkResponse({ type: [PostEntity] })
  findAllPosts() {
    return this.forumService.findAllPosts();
  }

  @Get('posts/action/:actionId')
  @ApiOperation({ summary: 'Get posts for a specific action' })
  @ApiOkResponse({ type: [PostEntity] })
  findPostsByAction(@Param('actionId') actionId: string) {
    return this.forumService.findPostsByAction(+actionId);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get a specific post with its replies' })
  @ApiOkResponse({ type: PostEntity })
  findOnePost(@Param('id') id: string) {
    return this.forumService.findOnePost(+id);
  }

  @Patch('posts/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a post' })
  @ApiOkResponse({ type: PostEntity })
  updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @ReqUser() user: JwtPayload,
  ) {
    return this.forumService.updatePost(+id, updatePostDto, user.sub);
  }

  @Delete('posts/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a post' })
  @ApiOkResponse({ type: Boolean })
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
  @ApiOkResponse({ type: Reply })
  updateReply(
    @Param('id') id: string,
    @Body() updateReplyDto: UpdateReplyDto,
    @ReqUser() user: JwtPayload,
  ) {
    return this.forumService.updateReply(+id, updateReplyDto, user.sub);
  }

  @Delete('replies/:id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a reply' })
  @ApiOkResponse({ type: Boolean })
  removeReply(@Param('id') id: string, @ReqUser() user: JwtPayload) {
    return this.forumService.removeReply(+id, user.sub);
  }
}
