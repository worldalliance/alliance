import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsNumber } from "class-validator";
import { Community } from "src/community/entities/community.entity";
import { getImageSource } from "src/images/images.service";
import { ProfileDto } from "src/user/dto/user.dto";

export class CommunityDto extends PickType(Community, [
  "id",
  "name",
  "description",
  "photo",
  "public",
  "allowMemberInvites",
  "allowStaffAssignments",
  "maxCapacity",
] as const) {
  @ApiProperty({ type: ProfileDto, isArray: true })
  @Allow()
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty({ type: ProfileDto, isArray: true })
  @Allow()
  @Type(() => ProfileDto)
  leaders: ProfileDto[];

  constructor(community: Community) {
    super();
    this.id = community.id;
    this.name = community.name;
    this.description = community.description;
    this.photo = community.photo ? getImageSource(community.photo) : undefined;
    this.public = community.public;
    this.allowMemberInvites = community.allowMemberInvites;
    this.allowStaffAssignments = community.allowStaffAssignments;
    this.maxCapacity = community.maxCapacity;
    this.users = community.users
      ? community.users.map((user) => new ProfileDto(user))
      : [];
    this.leaders = community.leaders
      ? community.leaders.map((user) => new ProfileDto(user))
      : [];
  }
}

export class CreateCommunityDto extends PickType(CommunityDto, [
  "name",
  "description",
  "photo",
  "public",
  "allowMemberInvites",
  "allowStaffAssignments",
  "maxCapacity",
]) {}

export class UpdateCommunityDto extends PartialType(CreateCommunityDto) {}

export class CommunityMemberDto {
  @ApiProperty()
  @IsNumber()
  userId: number;
}

export class MoveCommunityMemberDto extends CommunityMemberDto {
  @ApiProperty()
  @IsNumber()
  destinationCommunityId: number;
}
