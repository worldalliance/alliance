import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { User } from './user.entity';
import { FriendStatus } from './friend.entity';

export class UserDto extends PickType(User, [
  'name',
  'email',
  'admin',
  'id',
  'onboardingComplete',
]) {}

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
]) {}

export class UpdateProfileDto extends PartialType(ProfileDto) {}

export class OnboardingDto {
  @ApiProperty({ type: Number, nullable: true })
  cityId: number | null;

  @ApiProperty({ type: Boolean, nullable: true })
  over18: boolean | null;

  @ApiProperty({ type: Boolean, nullable: true })
  makesMoney: boolean | null;
}
