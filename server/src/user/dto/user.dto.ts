import { Temporal } from '@js-temporal/polyfill';
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { getImageSource } from 'src/images/images.service';
import { IsE164 } from 'src/utils/phone';
import { IsPlainTime, trimToPlainTime } from 'src/utils/plain-time';
import { trim, trimToNull } from 'src/utils/transforms';
import { ClusterSummaryDto } from '../../cluster/dto/cluster.dto';
import { Cluster } from '../../cluster/entities/cluster.entity';
import { Campaign } from '../../campaign/entities/campaign.entity';
import { City } from '../../geo/city.entity';
import { ShareUrl } from '../../share-urls/entities/share-url.entity';
import {
  compareContractEventsNewestFirst,
  ContractEvent,
  ContractEventType,
} from '../entities/contract-event.entity';
import { FriendStatus } from '../entities/friend.entity';
import { OnetimeInvite } from '../entities/onetime-invite.entity';
import { ReferralSource, User } from '../entities/user.entity';
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

export class ContractEventDto {
  @ApiProperty({ enum: ContractEventType, enumName: 'ContractEventType' })
  type: ContractEventType;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  automatic: boolean;

  @ApiProperty({ type: Number, nullable: true })
  contractId: number | null;

  constructor(
    input: Pick<ContractEvent, 'type' | 'date' | 'automatic' | 'contractId'>,
  ) {
    this.type = input.type;
    this.date = input.date;
    this.automatic = input.automatic;
    this.contractId = input.contractId;
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

  @ApiPropertyOptional({ type: ContractEventDto })
  lastContractEvent?: ContractEventDto;

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
    const lastContractEvent = user.contractEvents?.length
      ? user.contractEvents.sort(compareContractEventsNewestFirst)[0]
      : undefined;
    this.lastContractEvent = lastContractEvent
      ? new ContractEventDto(lastContractEvent)
      : undefined;
    if (user.anonymous) {
      this.displayName = 'Someone';
    } else {
      this.displayName = user.name;
    }

    this.profilePicture = user.profilePicture
      ? getImageSource(user.profilePicture)
      : null;

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

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  phoneNumber: string | null;

  @ApiProperty()
  @Allow()
  hasActiveContract: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  referredById?: number | null;

  @ApiPropertyOptional({ type: ContractEventDto, isArray: true })
  @IsOptional()
  @Type(() => ContractEventDto)
  contractEvents?: ContractEventDto[];

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
    this.contractEvents = user.contractEvents?.map(
      (event) => new ContractEventDto(event),
    );
    this.activities = user.activities;
    this.tags = user.tags;
    this.communities = user.communities;
    this.leaderOfIds = user.leaderOfIds;
    this.hasActiveContract = user.hasActiveContract;
    this.profilePicture = user.profilePicture
      ? getImageSource(user.profilePicture)
      : null;
    this.referredById = user.referredBy?.id ?? null;
    this.clusterId = user.clusterId;
  }
}

export type UserAdminInvitedBy =
  | {
      kind: 'user';
      user: User;
      referralSource: ReferralSource;
      shareUrl?: ShareUrl | null;
    }
  | { kind: 'campaign'; campaign: Campaign }
  | { kind: 'unknown'; referralSource: ReferralSource };

export class UserAdminInvitedByDto {
  @ApiProperty({
    enum: ['user', 'campaign', 'unknown'],
    enumName: 'UserAdminInvitedByKind',
  })
  kind: 'user' | 'campaign' | 'unknown';

  @ApiProperty()
  label: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  userId?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  campaignId?: number | null;

  @ApiPropertyOptional({ enum: ReferralSource, enumName: 'ReferralSource' })
  referralSource?: ReferralSource;

  @ApiPropertyOptional({ type: String, nullable: true })
  inviteLinkLabel?: string | null;

  constructor(input: UserAdminInvitedBy) {
    switch (input.kind) {
      case 'user':
        this.kind = 'user';
        this.label = input.user.name;
        this.userId = input.user.id;
        this.referralSource = input.referralSource;
        this.inviteLinkLabel = input.shareUrl?.label ?? null;
        break;
      case 'campaign':
        this.kind = 'campaign';
        this.label = input.campaign.name;
        this.campaignId = input.campaign.id;
        this.referralSource = ReferralSource.Campaign;
        break;
      case 'unknown':
        this.kind = 'unknown';
        this.label = humanizeReferralSource(input.referralSource);
        this.referralSource = input.referralSource;
        break;
      default:
        throw new Error(`unknown invited by kind: ${input satisfies never}`);
    }
  }
}

export class UserAdminLocationDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  cityId?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cityName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  countryName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  countryCode?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  customCityString?: string | null;

  constructor(input: { city?: City | null; customCityString?: string | null }) {
    this.cityId = input.city?.id ?? null;
    this.cityName = input.city?.englishName ?? input.city?.name ?? null;
    this.countryName = input.city?.countryName ?? null;
    this.countryCode = input.city?.countryCode ?? null;
    this.customCityString = input.customCityString ?? null;
  }
}

export type UserAdminDetail = User & {
  city?: City | null;
  referredBy?: User | null;
  referredByCampaign?: Campaign | null;
  referredByInvite?: (OnetimeInvite & { invitingUser?: User | null }) | null;
  referredByShareUrl?: ShareUrl | null;
};

export class UserAdminDetailDto extends UserDto {
  @ApiProperty({ type: () => UserAdminLocationDto })
  location: UserAdminLocationDto;

  @ApiProperty({ type: () => UserAdminInvitedByDto, nullable: true })
  invitedBy: UserAdminInvitedByDto | null;

  constructor(user: UserAdminDetail) {
    super(user);
    this.location = new UserAdminLocationDto({
      city: user.city,
      customCityString: user.customCityString,
    });
    this.invitedBy = userAdminInvitedBy(user);
  }
}

function userAdminInvitedBy(user: UserAdminDetail) {
  if (user.referredBy) {
    return new UserAdminInvitedByDto({
      kind: 'user',
      user: user.referredBy,
      referralSource: user.referralSource,
      shareUrl: user.referredByShareUrl,
    });
  }
  if (user.referredByCampaign) {
    return new UserAdminInvitedByDto({
      kind: 'campaign',
      campaign: user.referredByCampaign,
    });
  }
  if (user.referredByInvite?.invitingUser) {
    return new UserAdminInvitedByDto({
      kind: 'user',
      user: user.referredByInvite.invitingUser,
      referralSource: user.referralSource,
    });
  }
  if (user.referralSource !== ReferralSource.None) {
    return new UserAdminInvitedByDto({
      kind: 'unknown',
      referralSource: user.referralSource,
    });
  }
  return null;
}

function humanizeReferralSource(source: ReferralSource) {
  switch (source) {
    case ReferralSource.ReferralLink:
      return 'Referral link';
    case ReferralSource.OnetimeInvite:
      return 'One-time invite';
    case ReferralSource.ActionShareLink:
      return 'Action share link';
    case ReferralSource.ExternalShareLink:
      return 'External share link';
    case ReferralSource.InviteShareLink:
      return 'Invite share link';
    case ReferralSource.Campaign:
      return 'Campaign';
    case ReferralSource.None:
      return 'No invite';
    default:
      throw new Error(`unknown referral source: ${source satisfies never}`);
  }
}

export class UpdateProfileDto extends PartialType(
  PickType(User, [
    'name',
    'anonymous',
    'emailNotifsForActions',
    'pushNotifsForActions',
    'textNotifsForActions',
    'shareEmailWithCommunityLead',
    'remindAboutUncompletedGroupMembers',
    'receiveReplyNotifications',
    'sharePhoneNumberWithCommunityLead',
    'forumDigestPreference',
    'formDataPreference',
    'timeZone',
    'isNotSignedUpPartialProfile',
    'shareInfoPublicly',
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

  @IsOptional()
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsE164()
  phoneNumber?: string | null;

  @IsOptional()
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsString()
  @Transform(trimToNull)
  profilePicture?: string | null;

  @IsOptional()
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsPlainTime()
  @Transform(trimToPlainTime)
  preferredReminderTime?: Temporal.PlainTime | null;

  @IsOptional()
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsString()
  @Transform(trimToNull)
  profileDescription?: string | null;

  @IsOptional()
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsString()
  @Transform(trimToNull)
  customCityString?: string | null;
}

export class UpdateUserRolesAdminDto extends PartialType(
  PickType(User, ['ambassador', 'staff']),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ambassador?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  staff?: boolean;
}

export class DeleteUserAdminDto {
  @ApiProperty({ description: 'Posted to Slack; not stored on the account' })
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  reason: string;

  /**
   * Typed by the admin and checked against the account being deleted, so the
   * gesture names its own target — a fixed phrase would confirm equally well
   * on whichever profile happened to be open.
   */
  @ApiProperty({ description: "Must match the member's email address" })
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  confirmationEmail: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  screenshotKey?: string | null;
}

export class StaffDirectoryEntryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: String, nullable: true })
  profilePicture: string | null;

  @ApiProperty({ type: String, nullable: true })
  staffTitle: string | null;

  @ApiProperty({ type: String, nullable: true })
  staffLink: string | null;

  @ApiProperty()
  staffDisplayOrder: number;

  constructor(
    user: Pick<
      User,
      | 'id'
      | 'name'
      | 'anonymous'
      | 'profilePicture'
      | 'staffTitle'
      | 'staffLink'
      | 'staffDisplayOrder'
    >,
  ) {
    this.id = user.id;
    this.displayName = user.anonymous ? 'Someone' : user.name;
    this.profilePicture = user.profilePicture
      ? getImageSource(user.profilePicture)
      : null;
    this.staffTitle = user.staffTitle;
    this.staffLink = user.staffLink;
    this.staffDisplayOrder = user.staffDisplayOrder;
  }
}

export class StaffDirectoryItemUpdateDto {
  @ApiProperty()
  @IsInt()
  id: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  staffTitle?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(trimToNull)
  staffLink?: string | null;

  @ApiProperty()
  @IsInt()
  staffDisplayOrder: number;
}

export class UpdateStaffDirectoryDto {
  @ApiProperty({ type: () => StaffDirectoryItemUpdateDto, isArray: true })
  @Type(() => StaffDirectoryItemUpdateDto)
  @IsArray()
  @ValidateNested({ each: true })
  items: StaffDirectoryItemUpdateDto[];
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

export type MyVisibilityContext = {
  userHasCity: boolean;
  firstContractSignedAt: Date | null;
  completedActionCount: number;
};

/**
 * User-account-derived values consumed by form visibility conditions
 * (`userHasCity`, `firstContractSigned`, `completedActionCount`). Mirrors the
 * server-side extras used when stripping hidden answers at submission, so
 * clients preview the same visibility the server enforces.
 */
export class MyVisibilityContextDto {
  @ApiProperty()
  userHasCity: boolean;

  @ApiPropertyOptional({ type: Date })
  firstContractSignedAt?: Date;

  @ApiProperty()
  completedActionCount: number;

  constructor(input: MyVisibilityContext) {
    this.userHasCity = input.userHasCity;
    this.firstContractSignedAt = input.firstContractSignedAt ?? undefined;
    this.completedActionCount = input.completedActionCount;
  }
}
