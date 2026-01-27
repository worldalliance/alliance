import { ApiProperty, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsNumber } from 'class-validator';
import { Community } from './entities/community.entity';
import { ProfileDto } from './dto/user.dto';

export class CommunityDto extends OmitType(Community, [
  'users',
  'leaders',
  'invites',
]) {
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
    Object.assign(this, community);
    this.users = community.users
      ? community.users.map((user) => new ProfileDto(user))
      : [];
    this.leaders = community.leaders
      ? community.leaders.map((user) => new ProfileDto(user))
      : [];
  }
}

export class CreateCommunityDto extends PickType(CommunityDto, [
  'name',
  'description',
  'photo',
  'maxCapacity',
  'public',
]) {}

export class UpdateCommunityDto extends PartialType(CreateCommunityDto) {}

export class CommunityMemberDto {
  @ApiProperty()
  @IsNumber()
  userId: number;
}
