import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsOptional } from 'class-validator';
import { getImageSource } from 'src/images/images.service';
import { FriendStatus } from './friend.entity';
import { User } from './user.entity';

export class FriendStatusDto {
  @ApiProperty({ enum: FriendStatus, nullable: true, enumName: 'FriendStatus' })
  status: FriendStatus;
  @ApiProperty()
  didReceiveRequest: boolean;
}

export class ProfileDto extends PickType(User, [
  'admin',
  'staff',
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
      | 'admin'
      | 'staff'
      | 'email'
      | 'anonymous'
      | 'profilePicture'
      | 'profileDescription'
    >,
  ) {
    super();
    this.id = user.id;
    this.profileDescription = user.profileDescription;
    this.admin = user.admin;
    this.staff = user.staff;
    if (user.anonymous) {
      this.displayName = 'Someone';
    } else {
      this.displayName = user.name;
    }
    if (user.profilePicture) {
      this.profilePicture = getImageSource(user.profilePicture);
    }
  }
}

export class UserDto extends PickType(User, [
  'name',
  'email',
  'admin',
  'staff',
  'contractDateSigned',
  'contractDateSuspended',
  'id',
  'onboardingComplete',
  'emailNotifsEnabled',
  'pushNotifsEnabled',
  'textNotifsEnabled',
  'socialNotifsPreference',
  'turnedOffAllNotifs',
  'referralCode',
  'anonymous',
  'phoneNumber',
]) {
  @ApiPropertyOptional()
  @IsOptional()
  cityId?: number;

  @ApiProperty({ type: ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @Allow()
  friends: ProfileDto[];

  constructor(user: User) {
    super();
    Object.assign(this, user);
    this.friends = user.friends.map((friend) => new ProfileDto(friend));
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
