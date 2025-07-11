import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { User } from './user.entity';
import { FriendStatus } from './friend.entity';
import { IsOptional } from 'class-validator';

export class UserDto extends PickType(User, [
  'name',
  'email',
  'admin',
  'id',
  'onboardingComplete',
  'referralCode',
  'anonymous',
]) {
  @ApiPropertyOptional()
  cityId?: number;
}

export class MinimalUserDto extends PickType(UserDto, [
  'id',
  'name',
  'email',
]) {}

export class FriendStatusDto {
  @ApiProperty({ enum: FriendStatus, nullable: true })
  status: FriendStatus;
}

export class ProfileDto extends PickType(User, [
  'email',
  'admin',
  'id',
  'profilePicture',
  'profileDescription',
]) {
  @ApiProperty()
  displayName: string;

  constructor(
    user: Pick<
      User,
      | 'id'
      | 'name'
      | 'email'
      | 'anonymous'
      | 'profilePicture'
      | 'profileDescription'
    >,
  ) {
    super();
    Object.assign(this, user);
    if (user.anonymous) {
      this.displayName = 'Someone';
    } else {
      this.displayName = user.name;
    }
  }
}

// used instead of constructor to propagate nulls (TODO? ugly but maybe fine)
export function userToDto(user: User | null): ProfileDto | null {
  if (!user) {
    return null;
  }
  return new ProfileDto(user);
}

export class UpdateProfileDto extends PartialType(OmitType(User, ['city'])) {
  @ApiPropertyOptional()
  @IsOptional()
  cityId?: number;
}

export class OnboardingDto extends PickType(User, ['over18', 'anonymous']) {
  @ApiPropertyOptional()
  @IsOptional()
  cityId?: number;
}

export class ReferralDto {
  @ApiProperty({ type: String })
  referralCode: string;
}
