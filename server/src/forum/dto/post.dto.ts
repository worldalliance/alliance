import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { Post } from '../entities/post.entity';
import { UserDto } from '../../user/user.dto';
import { ReplyDto } from './reply.dto';

// return object for get requests
export class PostDto extends PickType(Post, [
  'id',
  'title',
  'content',
  'action',
  'actionId',
  'authorId',
  'createdAt',
  'updatedAt',
]) {
  //redefine to use compacted dto types
  @ApiProperty({ type: () => UserDto })
  author: UserDto;

  @ApiProperty({ type: () => [ReplyDto] })
  replies: ReplyDto[];
}

export class CreatePostDto extends PickType(Post, [
  'title',
  'content',
  'actionId',
]) {}

export class UpdatePostDto extends PartialType(CreatePostDto) {}
