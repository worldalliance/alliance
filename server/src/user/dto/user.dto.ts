import { publicDisplayName } from "@alliance/common/displayName";
import { Temporal } from "@js-temporal/polyfill";
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  Allow,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { OAuthAccount } from "src/auth/oauth/oauth-account.entity";
import { getImageSource } from "src/images/images.service";
import { IsE164 } from "src/utils/phone";
import { IsPlainTime, trimToPlainTime } from "src/utils/plain-time";
import { IsTimeZoneIdentifier } from "src/utils/timezone";
import { trim, trimToNull } from "src/utils/transforms";
import { ClusterSummaryDto } from "../../cluster/dto/cluster.dto";
import { Cluster } from "../../cluster/entities/cluster.entity";
import {
  ContractEvent,
  ContractEventType,
  findLastContractEvent,
} from "../entities/contract-event.entity";
import { FriendStatus } from "../entities/friend.entity";
import { hasPassword, User } from "../entities/user.entity";
import type { ReferrerResolution } from "../referral.service";

export type FriendStatusDtoArgs = {
  status: FriendStatus;
  didReceiveRequest: boolean;
};

export class FriendStatusDto {
  @ApiProperty({ enum: FriendStatus, nullable: true, enumName: "FriendStatus" })
  status: FriendStatus;

  @ApiProperty()
  didReceiveRequest: boolean;

  constructor(input: FriendStatusDtoArgs) {
    this.status = input.status;
    this.didReceiveRequest = input.didReceiveRequest;
  }
}

export class ContractEventDto {
  @ApiProperty({ enum: ContractEventType, enumName: "ContractEventType" })
  type: ContractEventType;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  automatic: boolean;

  @ApiProperty({ type: Number, nullable: true })
  contractId: number | null;

  constructor(
    input: Pick<ContractEvent, "type" | "date" | "automatic" | "contractId">,
  ) {
    this.type = input.type;
    this.date = input.date;
    this.automatic = input.automatic;
    this.contractId = input.contractId;
  }
}

function toLastContractEventDto(
  events: ContractEvent[] | undefined,
): ContractEventDto | undefined {
  const last = findLastContractEvent(events ?? []);
  return last ? new ContractEventDto(last) : undefined;
}

export class ProfileDto extends PickType(User, [
  "admin",
  "staff",
  "ambassador",
  "id",
  "profilePicture",
  "profileDescription",
  "anonymous",
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
      | "id"
      | "name"
      | "admin"
      | "staff"
      | "ambassador"
      | "email"
      | "anonymous"
      | "profilePicture"
      | "profileDescription"
      | "hasActiveContract"
      | "isCommunityLeader"
      | "contractEvents"
    > & { cluster?: Pick<Cluster, "id" | "displayName"> | null },
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
    this.lastContractEvent = toLastContractEventDto(user.contractEvents);
    this.displayName = publicDisplayName(user);

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
  @ApiProperty({ enum: ["user", "campaign"], enumName: "ReferrerKind" })
  kind: "user" | "campaign";

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: String, nullable: true })
  profilePicture: string | null;

  constructor(input: ReferrerResolution) {
    switch (input.kind) {
      case "user":
        this.kind = "user";
        this.displayName = publicDisplayName(input.user);
        this.profilePicture = input.user.profilePicture
          ? getImageSource(input.user.profilePicture)
          : null;
        break;
      case "campaign":
        this.kind = "campaign";
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

export class OAuthAccountDto extends PickType(OAuthAccount, [
  "provider",
  "email",
]) {
  constructor(input: OAuthAccount) {
    super();
    this.provider = input.provider;
    this.email = input.email;
  }
}

export class UserDto extends PickType(User, [
  "name",
  "admin",
  "staff",
  "ambassador",
  "id",
  "profileDescription",
  "switchedDomainAt",
  "referralCode",
  "referralSource",
  "referredById",
  "referredByCampaignId",
  "anonymous",
  "phoneNumber",
  "communities",
  "profilePicture",
  "leaderOfIds",
  "activities",
  "shareEmailWithCommunityLead",
  "sharePhoneNumberWithCommunityLead",
  "preferredReminderTime",
  "timeZone",
  "formDataPreference",
  "shareInfoPublicly",
  "customCityString",
  "undergoingGroupAssignment",
  "tags",
  "clusterId",
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

  @ApiPropertyOptional({ type: ContractEventDto, isArray: true })
  @IsOptional()
  @Type(() => ContractEventDto)
  contractEvents?: ContractEventDto[];

  @ApiPropertyOptional({ type: ContractEventDto })
  @IsOptional()
  @Type(() => ContractEventDto)
  lastContractEvent?: ContractEventDto;

  @ApiPropertyOptional({ type: () => OAuthAccountDto, isArray: true })
  @IsOptional()
  @Type(() => OAuthAccountDto)
  oauthAccounts?: OAuthAccountDto[];

  @ApiProperty()
  @Allow()
  hasPassword: boolean;

  constructor(user: User) {
    super();
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.phoneNumber = user.phoneNumber;
    this.preferredReminderTime = user.preferredReminderTime;
    this.timeZone = user.timeZone;
    this.shareEmailWithCommunityLead = user.shareEmailWithCommunityLead;
    this.sharePhoneNumberWithCommunityLead =
      user.sharePhoneNumberWithCommunityLead;
    this.switchedDomainAt = user.switchedDomainAt;
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
    this.undergoingGroupAssignment = user.undergoingGroupAssignment;
    this.contractEvents = user.contractEvents?.map(
      (event) => new ContractEventDto(event),
    );
    this.lastContractEvent = toLastContractEventDto(user.contractEvents);
    this.activities = user.activities;
    this.tags = user.tags;
    this.communities = user.communities;
    this.leaderOfIds = user.leaderOfIds;
    this.hasActiveContract = user.hasActiveContract;
    this.profilePicture = user.profilePicture
      ? getImageSource(user.profilePicture)
      : null;
    this.referredById = user.referredById;
    this.referredByCampaignId = user.referredByCampaignId;
    this.clusterId = user.clusterId;
    this.oauthAccounts = user.oauthAccounts?.map(
      (account) => new OAuthAccountDto(account),
    );
    this.hasPassword = hasPassword(user);
  }
}

export class UpdateProfileDto extends PartialType(
  PickType(User, [
    "anonymous",
    "shareEmailWithCommunityLead",
    "sharePhoneNumberWithCommunityLead",
    "formDataPreference",
    "shareInfoPublicly",
  ]),
) {
  @IsOptional()
  @ApiPropertyOptional({ type: String })
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  name?: string;

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

  @IsOptional()
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "null leaves the saved zone unchanged",
  })
  @IsTimeZoneIdentifier()
  // Older mobile builds send back /auth/me's null.
  @Transform(({ value }) => value ?? undefined)
  timeZone?: string;
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
      | "id"
      | "name"
      | "anonymous"
      | "profilePicture"
      | "staffTitle"
      | "staffLink"
      | "staffDisplayOrder"
    >,
  ) {
    this.id = user.id;
    this.displayName = publicDisplayName(user);
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
