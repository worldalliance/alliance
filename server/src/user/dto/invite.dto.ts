import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Allow, IsNumber, IsOptional } from 'class-validator';
import { OnetimeInvite } from '../entities/onetime-invite.entity';
import { CommunityInvite } from '../entities/community-invite.entity';
import { ProfileDto } from '../user.dto';
import { Type } from 'class-transformer';

export class CreateOnetimeInviteDto extends PickType(OnetimeInvite, [
  'invitee',
]) {
  @ApiPropertyOptional()
  @IsOptional()
  invitingUserId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  communityId?: number;
}

export class CreateCommunityInviteDto {
  @ApiProperty()
  @Allow()
  invitedUserId: number;

  @ApiProperty()
  @Allow()
  communityId: number;
}

export class CommunityInviteDto extends PickType(CommunityInvite, [
  'id',
  'status',
  'createdAt',
  'updatedAt',
  'community',
]) {
  @ApiPropertyOptional({ type: ProfileDto })
  invitedUser?: ProfileDto;

  @ApiPropertyOptional({ type: ProfileDto })
  invitingUser?: ProfileDto;

  constructor(communityInvite: CommunityInvite) {
    super();
    Object.assign(this, communityInvite);
    this.invitedUser = communityInvite.invitedUser
      ? new ProfileDto(communityInvite.invitedUser)
      : undefined;
    this.invitingUser = communityInvite.invitingUser
      ? new ProfileDto(communityInvite.invitingUser)
      : undefined;
  }
}

export class OnetimeInviteDto extends PickType(OnetimeInvite, [
  'id',
  'invitee',
  'inviteeDescription',
  'code',
  'status',
  'createdAt',
  'community',
]) {
  @ApiProperty({ type: ProfileDto })
  @Type(() => ProfileDto)
  invitingUser: ProfileDto;

  constructor(onetimeInvite: OnetimeInvite) {
    super();
    Object.assign(this, onetimeInvite);
    this.invitingUser = new ProfileDto(onetimeInvite.invitingUser);
  }
}

export class RequestOnetimeInviteDto extends PickType(OnetimeInvite, [
  'invitee',
  'inviteeDescription',
]) {
  @ApiPropertyOptional()
  @IsOptional()
  invitingUserId?: number;

  @ApiProperty()
  @Allow()
  communityId: number;
}
