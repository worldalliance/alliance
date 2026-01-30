import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { instanceToPlain, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { getImageSource } from 'src/images/images.service';
import { FriendStatus } from '../entities/friend.entity';
import { User } from '../entities/user.entity';
import { ContractEvent } from '../entities/contract-event.entity';

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

  @ApiProperty()
  hasActiveContract: boolean;

  @ApiProperty()
  isCommunityLeader: boolean;

  @ApiPropertyOptional({ type: ContractEvent })
  lastContractEvent?: ContractEvent;

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
      | 'hasActiveContract'
      | 'isCommunityLeader'
      | 'contractEvents'
    >,
  ) {
    super();
    this.id = user.id;
    this.profileDescription = user.profileDescription;
    this.admin = user.admin;
    this.staff = user.staff;
    this.hasActiveContract = user.hasActiveContract;
    this.isCommunityLeader = user.isCommunityLeader;
    this.lastContractEvent = user.contractEvents?.length
      ? user.contractEvents?.sort(
          (a, b) => b.date.getTime() - a.date.getTime(),
        )[0]
      : undefined;
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

export class ProfileDtoWithFriends extends ProfileDto {
  @ApiProperty({ type: ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  @Allow()
  friends: ProfileDto[];

  constructor(user: User) {
    super(user);
    this.friends = user.friends.map((friend) => new ProfileDto(friend));
  }
}

export class UserDto extends PickType(User, [
  'name',
  'admin',
  'staff',
  'id',
  'onboardingComplete',
  'emailNotifsEnabled',
  'pushNotifsEnabled',
  'textNotifsEnabled',
  'socialNotifsPreference',
  'profileDescription',
  'forumDigestPreference',
  'turnedOffAllNotifs',
  'invitedCommunities',
  'referralCode',
  'anonymous',
  'pushesForLikes',
  'pushesForComments',
  'pushesForFriendRequests',
  'preferredActionReminderChannel',
  'phoneNumber',
  'communities',
  'profilePicture',
  'activities',
  'shareEmailWithCommunityLead',
  'sharePhoneNumberWithCommunityLead',
  'preferredReminderTime',
  'timeZone',
  'formDataPreference',
  'contractEvents',
  'shareInfoPublicly',
  'customCityString',
  'isIntroductoryGroupMember',
  'undergoingGroupAssignment',
]) {
  @ApiPropertyOptional()
  @IsOptional()
  cityId?: number;

  @ApiProperty()
  @Allow()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty()
  @Allow()
  hasActiveContract: boolean;

  constructor(user: User) {
    super();
    Object.assign(this, instanceToPlain(user));
    this.profilePicture = getImageSource(user.profilePicture);
  }
}

// used instead of constructor to propagate nulls (TODO? ugly but maybe fine)
export function userToDto(user: User | null): ProfileDto | null {
  if (!user) {
    return null;
  }
  return new ProfileDto(user);
}

export class UpdateProfileDto extends PartialType(
  PickType(User, [
    'name',
    'phoneNumber',
    'phoneNumberValidated',
    'profileDescription',
    'profilePicture',
    'anonymous',
    'emailNotifsEnabled',
    'pushNotifsEnabled',
    'textNotifsEnabled',
    'shareEmailWithCommunityLead',
    'sharePhoneNumberWithCommunityLead',
    'forumDigestPreference',
    'preferredActionReminderChannel',
    'preferredReminderTime',
    'formDataPreference',
    'timeZone',
    'isNotSignedUpPartialProfile',
    'shareInfoPublicly',
    'customCityString',
    'pushesForLikes',
    'pushesForComments',
    'pushesForFriendRequests',
  ]),
) {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  cityId?: number | null;
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

export class SingleGroupAssignmentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  communityId: number;
}

export class AssignGroupsDto {
  @ApiProperty({ type: SingleGroupAssignmentDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleGroupAssignmentDto)
  assignments: Array<SingleGroupAssignmentDto>;
}
