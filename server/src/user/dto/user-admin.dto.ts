import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { trim, trimToNull } from "src/utils/transforms";
import { Campaign } from "../../campaign/entities/campaign.entity";
import { City } from "../../geo/city.entity";
import { ShareUrl } from "../../share-urls/entities/share-url.entity";
import {
  loadedOnetimeInviteInvitingUser,
  OnetimeInvite,
} from "../entities/onetime-invite.entity";
import { Tag } from "../entities/tag.entity";
import { loadedUserTags, ReferralSource, User } from "../entities/user.entity";
import { UserDto } from "./user.dto";

export type UserAdminInvitedBy =
  | {
      kind: "user";
      user: User;
      referralSource: ReferralSource;
      shareUrl?: ShareUrl | null;
    }
  | { kind: "campaign"; campaign: Campaign }
  | { kind: "unknown"; referralSource: ReferralSource };

export class UserAdminInvitedByDto {
  @ApiProperty({
    enum: ["user", "campaign", "unknown"],
    enumName: "UserAdminInvitedByKind",
  })
  kind: "user" | "campaign" | "unknown";

  @ApiProperty()
  label: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  userId?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  campaignId?: number | null;

  @ApiPropertyOptional({ enum: ReferralSource, enumName: "ReferralSource" })
  referralSource?: ReferralSource;

  @ApiPropertyOptional({ type: String, nullable: true })
  inviteLinkLabel?: string | null;

  constructor(input: UserAdminInvitedBy) {
    switch (input.kind) {
      case "user":
        this.kind = "user";
        this.label = input.user.name;
        this.userId = input.user.id;
        this.referralSource = input.referralSource;
        this.inviteLinkLabel = input.shareUrl?.label ?? null;
        break;
      case "campaign":
        this.kind = "campaign";
        this.label = input.campaign.name;
        this.campaignId = input.campaign.id;
        this.referralSource = ReferralSource.Campaign;
        break;
      case "unknown":
        this.kind = "unknown";
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
  referredByInvite?: OnetimeInvite | null;
  referredByShareUrl?: ShareUrl | null;
};

export class UserAdminDetailDto extends UserDto {
  @ApiProperty({ type: () => UserAdminLocationDto })
  location: UserAdminLocationDto;

  @ApiProperty({ type: () => UserAdminInvitedByDto, nullable: true })
  invitedBy: UserAdminInvitedByDto | null;

  // eslint-disable-next-line @darraghor/nestjs-typed/api-property-matches-property-optionality -- without it, @ApiProperty keeps UserDto's inherited required: false
  @ApiProperty({ type: () => Tag, isArray: true, required: true })
  @Type(() => Tag)
  tags: Tag[];

  constructor(user: UserAdminDetail) {
    super(user);
    this.tags = loadedUserTags(user);
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
      kind: "user",
      user: user.referredBy,
      referralSource: user.referralSource,
      shareUrl: user.referredByShareUrl,
    });
  }
  if (user.referredByCampaign) {
    return new UserAdminInvitedByDto({
      kind: "campaign",
      campaign: user.referredByCampaign,
    });
  }
  const inviter =
    user.referredByInvite &&
    loadedOnetimeInviteInvitingUser(user.referredByInvite);
  if (inviter) {
    return new UserAdminInvitedByDto({
      kind: "user",
      user: inviter,
      referralSource: user.referralSource,
    });
  }
  if (user.referralSource !== ReferralSource.None) {
    return new UserAdminInvitedByDto({
      kind: "unknown",
      referralSource: user.referralSource,
    });
  }
  return null;
}

function humanizeReferralSource(source: ReferralSource) {
  switch (source) {
    case ReferralSource.ReferralLink:
      return "Referral link";
    case ReferralSource.OnetimeInvite:
      return "One-time invite";
    case ReferralSource.ActionShareLink:
      return "Action share link";
    case ReferralSource.ExternalShareLink:
      return "External share link";
    case ReferralSource.InviteShareLink:
      return "Invite share link";
    case ReferralSource.Campaign:
      return "Campaign";
    case ReferralSource.None:
      return "No invite";
    default:
      throw new Error(`unknown referral source: ${source satisfies never}`);
  }
}

export class UpdateUserRolesAdminDto extends PartialType(
  PickType(User, ["ambassador", "staff", "admin"]),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ambassador?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  staff?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  admin?: boolean;
}

export class DeleteUserAdminDto {
  @ApiProperty({ description: "Posted to Slack; not stored on the account" })
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
