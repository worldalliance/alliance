import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { Post } from '../entities/post.entity';
import { MinimalUserDto } from '../../user/user.dto';
import { ReplyDto } from './reply.dto';
import { ActionDto } from 'src/actions/dto/action.dto';

// return object for get requests
export class PostDto extends PickType(Post, [
  'id',
  'title',
  'content',
  'actionId',
  'authorId',
  'createdAt',
  'updatedAt',
]) {
  //redefine to use compacted dto types
  @ApiProperty({ type: () => ActionDto, required: false })
  action: ActionDto | undefined;

  @ApiProperty({ type: MinimalUserDto })
  author: MinimalUserDto;

  @ApiProperty({ type: () => [ReplyDto] })
  replies: ReplyDto[];
}

export class CreatePostDto extends PickType(Post, [
  'title',
  'content',
  'actionId',
]) {}

export class UpdatePostDto extends PartialType(CreatePostDto) {}
