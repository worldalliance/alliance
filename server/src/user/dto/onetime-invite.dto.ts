import { publicDisplayName } from "@alliance/common/displayName";
import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { CommunityDto } from "src/community/dto/community.dto";
import { getImageSource } from "src/images/images.service";
import { type PaginatedList, PaginatedListDto } from "src/utils/pagination.dto";
import { OnetimeInvite } from "../entities/onetime-invite.entity";
import { User } from "../entities/user.entity";
import { isInviteAccepted } from "../invite-claim";
import { ProfileDto } from "./user.dto";

export class CreateOnetimeInviteDto extends PickType(OnetimeInvite, [
  "invitee",
]) {
  @ApiPropertyOptional()
  @IsOptional()
  info?: string;

  @ApiPropertyOptional()
  @IsOptional()
  invitingUserId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  communityId?: number;
}

export class UpdateOnetimeInviteDto {
  @ApiPropertyOptional({
    description: "Omit to leave the invitee name as it is.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invitee?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      "Group the invitee joins: a group you lead, or null for any open group. Omit to leave it as it is.",
  })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  communityId?: number | null;
}

export class OnetimeInviteDto extends PickType(OnetimeInvite, [
  "id",
  "invitee",
  "inviteeDescription",
  "info",
  "code",
  "status",
  "createdAt",
  "invitedUserId",
]) {
  @ApiPropertyOptional({ type: CommunityDto, nullable: true })
  @Type(() => CommunityDto)
  community?: CommunityDto | null;

  @ApiPropertyOptional({ type: ProfileDto })
  @Type(() => ProfileDto)
  invitingUser?: ProfileDto;

  @ApiPropertyOptional({ type: ProfileDto })
  @Type(() => ProfileDto)
  invitedUser?: ProfileDto;

  @ApiProperty()
  accepted: boolean;

  constructor(onetimeInvite: OnetimeInvite) {
    super();
    this.id = onetimeInvite.id;
    this.invitee = onetimeInvite.invitee;
    this.inviteeDescription = onetimeInvite.inviteeDescription;
    this.info = onetimeInvite.info;
    this.code = onetimeInvite.code;
    this.status = onetimeInvite.status;
    this.createdAt = onetimeInvite.createdAt;
    this.community = onetimeInvite.community
      ? new CommunityDto(onetimeInvite.community)
      : onetimeInvite.community;
    this.invitedUserId = onetimeInvite.invitedUserId;
    this.accepted = isInviteAccepted(onetimeInvite);
    this.invitingUser = onetimeInvite.invitingUser
      ? new ProfileDto(onetimeInvite.invitingUser)
      : undefined;
    this.invitedUser = onetimeInvite.invitedUser
      ? new ProfileDto(onetimeInvite.invitedUser)
      : undefined;
  }
}

export type OnetimeInviteList = PaginatedList<OnetimeInvite>;

export class OnetimeInviteListDto extends PaginatedListDto(OnetimeInviteDto) {}

export type OnetimeInviteMemberStats = {
  invitingUser: User;
  sent: number;
  accepted: number;
};

/**
 * Slim user shape for invite member stats. Not `ProfileDto`: the stats query
 * loads users without the relations its computed fields
 * (`hasActiveContract`, `isCommunityLeader`) depend on, so those would
 * silently serialize as `false`.
 */
export class OnetimeInviteMemberUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: String, nullable: true })
  profilePicture: string | null;

  constructor(input: User) {
    this.id = input.id;
    this.displayName = publicDisplayName(input);
    this.profilePicture = input.profilePicture
      ? getImageSource(input.profilePicture)
      : null;
  }
}

export class OnetimeInviteMemberStatsDto {
  @ApiProperty({ type: () => OnetimeInviteMemberUserDto })
  invitingUser: OnetimeInviteMemberUserDto;

  @ApiProperty()
  sent: number;

  @ApiProperty()
  accepted: number;

  constructor(input: OnetimeInviteMemberStats) {
    this.invitingUser = new OnetimeInviteMemberUserDto(input.invitingUser);
    this.sent = input.sent;
    this.accepted = input.accepted;
  }
}

export type OnetimeInviteEdge = {
  invitingUserId: number;
  invitedUserId: number;
};

export class OnetimeInviteEdgeDto {
  @ApiProperty()
  invitingUserId: number;

  @ApiProperty()
  invitedUserId: number;

  constructor(input: OnetimeInviteEdge) {
    this.invitingUserId = input.invitingUserId;
    this.invitedUserId = input.invitedUserId;
  }
}

export class RequestOnetimeInviteDto extends PickType(OnetimeInvite, [
  "invitee",
]) {
  @ApiPropertyOptional()
  @IsOptional()
  inviteeDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  invitingUserId?: number;

  @ApiProperty()
  @Allow()
  communityId: number;
}
