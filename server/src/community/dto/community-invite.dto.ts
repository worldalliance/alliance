import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow } from "class-validator";
import { CommunityDto } from "src/community/dto/community.dto";
import {
  CommunityInvite,
  loadedCommunityInviteCommunity,
} from "src/community/entities/community-invite.entity";
import { ProfileDto } from "src/user/dto/user.dto";

export class CreateCommunityInviteDto {
  @ApiProperty()
  @Allow()
  invitedUserId: number;

  @ApiProperty()
  @Allow()
  communityId: number;
}

export class RequestCommunityInviteDto {
  @ApiProperty()
  @Allow()
  communityId: number;

  @ApiProperty()
  @Allow()
  invitedUserId: number;
}

export class CommunityInviteDto extends PickType(CommunityInvite, [
  "id",
  "status",
  "createdAt",
  "updatedAt",
]) {
  @ApiProperty({ type: CommunityDto })
  @Type(() => CommunityDto)
  community: CommunityDto;

  @ApiPropertyOptional({ type: ProfileDto })
  invitedUser?: ProfileDto;

  @ApiPropertyOptional({ type: ProfileDto })
  invitingUser?: ProfileDto;

  constructor(communityInvite: CommunityInvite) {
    super();
    this.id = communityInvite.id;
    this.status = communityInvite.status;
    this.createdAt = communityInvite.createdAt;
    this.updatedAt = communityInvite.updatedAt;
    this.community = new CommunityDto(
      loadedCommunityInviteCommunity(communityInvite),
    );
    this.invitedUser = communityInvite.invitedUser
      ? new ProfileDto(communityInvite.invitedUser)
      : undefined;
    this.invitingUser = communityInvite.invitingUser
      ? new ProfileDto(communityInvite.invitingUser)
      : undefined;
  }
}
