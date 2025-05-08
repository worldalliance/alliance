import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { Post } from '../entities/post.entity';
import { UserDto } from '../../user/user.dto';

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
  'replies',
]) {
  @ApiProperty({ type: UserDto })
  author: UserDto;
}

export class CreatePostDto extends PickType(Post, [
  'title',
  'content',
  'actionId',
]) {}

export class UpdatePostDto extends PartialType(CreatePostDto) {}
