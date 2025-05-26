import { ApiProperty, PickType } from '@nestjs/swagger';
import { User } from './user.entity';
import { FriendStatus } from './friend.entity';
import { ActionDto } from 'src/actions/dto/action.dto';
import { PostDto } from 'src/forum/dto/post.dto';

export class UserDto extends PickType(User, ['name', 'email', 'admin', 'id']) {}

export class FriendStatusDto {
  @ApiProperty({ enum: FriendStatus })
  status: FriendStatus;
}

export class ProfileDto extends PickType(User, [
  'name',
  'email',
  'admin',
  'id',
  'profilePicture',
  'profileDescription',
]) {
  completedActions: ActionDto[];
  forumPosts: PostDto[];
  friends: UserDto[];
}
