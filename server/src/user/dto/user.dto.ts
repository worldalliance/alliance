import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { getImageSource } from 'src/images/images.service';
import { ClusterSummaryDto } from '../../cluster/dto/cluster.dto';
import { Cluster } from '../../cluster/entities/cluster.entity';
import {
  compareContractEventsNewestFirst,
  ContractEvent,
} from '../entities/contract-event.entity';
import { FriendStatus } from '../entities/friend.entity';
import { User } from '../entities/user.entity';
import type { ReferrerResolution } from '../user.service';

export type FriendStatusDtoArgs = {
  status: FriendStatus;
  didReceiveRequest: boolean;
};

export class FriendStatusDto {
  @ApiProperty({ enum: FriendStatus, nullable: true, enumName: 'FriendStatus' })
  status: FriendStatus;

  @ApiProperty()
  didReceiveRequest: boolean;

  constructor(input: FriendStatusDtoArgs) {
    this.status = input.status;
    this.didReceiveRequest = input.didReceiveRequest;
  }
}

export class ProfileDto extends PickType(User, [
  'admin',
  'staff',
  'ambassador',
  'id',
  'profilePicture',
  'profileDescription',
  'anonymous',
]) {
  @ApiProperty()
  displayName: string;

  @ApiProperty()
  hasActiveContract: boolean;

  @ApiProperty()
  isCommunityLeader: boolean;

  @ApiPropertyOptional({ type: ContractEvent })
  lastContractEvent?: ContractEvent;

  @ApiPropertyOptional({ type: ClusterSummaryDto })
  cluster?: ClusterSummaryDto;

  constructor(
    user: Pick<
      User,
      | 'id'
      | 'name'
      | 'admin'
      | 'staff'
      | 'ambassador'
      | 'email'
      | 'anonymous'
      | 'profilePicture'
      | 'profileDescription'
      | 'hasActiveContract'
      | 'isCommunityLeader'
      | 'contractEvents'
    > & { cluster?: Pick<Cluster, 'id' | 'displayName'> | null },
  ) {
    super();
    this.id = user.id;
    this.profileDescription = user.profileDescription;
    this.admin = user.admin;
    this.staff = user.staff;
    this.ambassador = user.ambassador;
    this.hasActiveContract = user.hasActiveContract;
    this.isCommunityLeader = user.isCommunityLeader;
    this.anonymous = user.anonymous;
    this.lastContractEvent = user.contractEvents?.length
      ? user.contractEvents?.sort(compareContractEventsNewestFirst)[0]
      : undefined;
    if (user.anonymous) {
      this.displayName = 'Someone';
    } else {
      this.displayName = user.name;
    }

    if (user.profilePicture) {
      this.profilePicture = getImageSource(user.profilePicture);
    }

    if (user.cluster) {
      this.cluster = new ClusterSummaryDto(user.cluster);
    }
  }
}

/**
 * Who referred a signup, for display on the signup page. Either a referring
 * user or a userless campaign (`kind` tells the client which copy to show —
 * "Invited by {name}" vs "Invited via {name}").
 */
export class ReferrerProfileDto {
  @ApiProperty({ enum: ['user', 'campaign'], enumName: 'ReferrerKind' })
  kind: 'user' | 'campaign';

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: String, nullable: true })
  profilePicture: string | null;

  constructor(input: ReferrerResolution) {
    switch (input.kind) {
      case 'user':
        this.kind = 'user';
        this.displayName = input.user.anonymous ? 'Someone' : input.user.name;
        this.profilePicture = input.user.profilePicture
          ? getImageSource(input.user.profilePicture)
          : null;
        break;
      case 'campaign':
        this.kind = 'campaign';
        this.displayName = input.campaign.name;
        this.profilePicture = input.campaign.picture
          ? getImageSource(input.campaign.picture)
          : null;
        break;
      default:
        throw new Error(`unknown referrer kind: ${input satisfies never}`);
    }
  }
}

export class ProfileDtoWithFriends extends ProfileDto {
  @ApiProperty({ type: Number, isArray: true })
  friendIds: number[];

  constructor(user: User, friendIds: number[]) {
    super(user);
    this.friendIds = friendIds;
  }
}

/** Public signup page: overlapping avatars + name line (min 5 faces when DB allows). */
export class SignupSocialProofDto {
  @ApiProperty({ type: ProfileDto, isArray: true })
  profiles: ProfileDto[];

  constructor(users: User[]) {
    this.profiles = users.map((u) => new ProfileDto(u));
  }
}

export class UserDto extends PickType(User, [
  'name',
  'admin',
  'staff',
  'ambassador',
  'id',
  'emailNotifsForActions',
  'pushNotifsForActions',
  'textNotifsForActions',
  'profileDescription',
  'forumDigestPreference',
  'turnedOffAllNotifs',
  'referralCode',
  'referralSource',
  'anonymous',
  'pushesForLikes',
  'pushesForComments',
  'pushesForFriendRequests',
  'pushesForMessages',
  'pushesForActionUpdates',
  'phoneNumber',
  'communities',
  'profilePicture',
  'leaderOfIds',
  'activities',
  'shareEmailWithCommunityLead',
  'sharePhoneNumberWithCommunityLead',
  'preferredReminderTime',
  'remindAboutUncompletedGroupMembers',
  'timeZone',
  'formDataPreference',
  'contractEvents',
  'shareInfoPublicly',
  'customCityString',
  'undergoingGroupAssignment',
  'receiveReplyNotifications',
  'tags',
  'clusterId',
]) {
  @ApiProperty()
  @Allow()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty()
  @Allow()
  hasActiveContract: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  referredById?: number | null;

  constructor(user: User) {
    super();
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.phoneNumber = user.phoneNumber;
    this.preferredReminderTime = user.preferredReminderTime;
    this.timeZone = user.timeZone;
    this.emailNotifsForActions = user.emailNotifsForActions;
    this.textNotifsForActions = user.textNotifsForActions;
    this.pushNotifsForActions = user.pushNotifsForActions;
    this.shareEmailWithCommunityLead = user.shareEmailWithCommunityLead;
    this.sharePhoneNumberWithCommunityLead =
      user.sharePhoneNumberWithCommunityLead;
    this.turnedOffAllNotifs = user.turnedOffAllNotifs;
    this.forumDigestPreference = user.forumDigestPreference;
    this.admin = user.admin;
    this.staff = user.staff;
    this.ambassador = user.ambassador;
    this.profileDescription = user.profileDescription;
    this.referralCode = user.referralCode;
    this.referralSource = user.referralSource;
    this.customCityString = user.customCityString;
    this.anonymous = user.anonymous;
    this.shareInfoPublicly = user.shareInfoPublicly;
    this.formDataPreference = user.formDataPreference;
    this.pushesForLikes = user.pushesForLikes;
    this.pushesForComments = user.pushesForComments;
    this.pushesForFriendRequests = user.pushesForFriendRequests;
    this.pushesForMessages = user.pushesForMessages;
    this.pushesForActionUpdates = user.pushesForActionUpdates;
    this.undergoingGroupAssignment = user.undergoingGroupAssignment;
    this.remindAboutUncompletedGroupMembers =
      user.remindAboutUncompletedGroupMembers;
    this.receiveReplyNotifications = user.receiveReplyNotifications;
    this.contractEvents = user.contractEvents;
    this.activities = user.activities;
    this.tags = user.tags;
    this.communities = user.communities;
    this.leaderOfIds = user.leaderOfIds;
    this.hasActiveContract = user.hasActiveContract;
    this.profilePicture = getImageSource(user.profilePicture);
    this.referredById = user.referredBy?.id ?? null;
    this.clusterId = user.clusterId;
  }
}

export class UpdateProfileDto extends PartialType(
  PickType(User, [
    'name',
    'phoneNumber',
    'phoneNumberValidated',
    'profileDescription',
    'profilePicture',
    'anonymous',
    'emailNotifsForActions',
    'pushNotifsForActions',
    'textNotifsForActions',
    'shareEmailWithCommunityLead',
    'remindAboutUncompletedGroupMembers',
    'receiveReplyNotifications',
    'sharePhoneNumberWithCommunityLead',
    'forumDigestPreference',
    'preferredReminderTime',
    'formDataPreference',
    'timeZone',
    'isNotSignedUpPartialProfile',
    'shareInfoPublicly',
    'customCityString',
    'pushesForLikes',
    'pushesForComments',
    'pushesForFriendRequests',
    'pushesForMessages',
    'pushesForActionUpdates',
  ]),
) {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  cityId?: number | null;
}

export class UpdateUserRolesAdminDto extends PartialType(
  PickType(User, ['ambassador']),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ambassador?: boolean;
}

export class ReferralDto {
  @ApiProperty({ type: String })
  referralCode: string;
}

export type UserCityCount = {
  cityId: number | null;
  cityName: string | null;
  countryCode: string | null;
  count: number;
  latitude: number | null;
  longitude: number | null;
};

export class UserCityCountDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  cityId?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  cityName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  countryCode?: string | null;

  @ApiProperty()
  @Allow()
  count: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  latitude?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  longitude?: number | null;

  constructor(input: UserCityCount) {
    this.cityId = input.cityId;
    this.cityName = input.cityName;
    this.countryCode = input.countryCode;
    this.count = input.count;
    this.latitude = input.latitude;
    this.longitude = input.longitude;
  }
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

export class NMembersResponseDto {
  @ApiProperty()
  @Allow()
  count: number;

  constructor(count: number) {
    this.count = count;
  }
}
