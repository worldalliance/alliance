import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ShareUrlKind,
  type ShareUrlWithSignupCount,
} from '../entities/share-url.entity';
import {
  getStoredInviteAssignment,
  InviteAssignmentKind,
  type StoredInviteAssignment,
} from '../invite-assignment';

type InviteAssignmentDetails = {
  assignmentKind: InviteAssignmentKind;
  communityId: number | null;
};

function inviteAssignmentDetails(
  assignment: StoredInviteAssignment | null,
): InviteAssignmentDetails {
  if (assignment === null) {
    return {
      assignmentKind: InviteAssignmentKind.Automatic,
      communityId: null,
    };
  }
  switch (assignment.kind) {
    case 'community':
      return {
        assignmentKind: InviteAssignmentKind.Community,
        communityId: assignment.communityId,
      };
    case 'open':
      return {
        assignmentKind: InviteAssignmentKind.Open,
        communityId: null,
      };
    default:
      throw new Error(
        `unknown invite assignment: ${assignment satisfies never}`,
      );
  }
}

export class GetShareLinkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  actionId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  externalTargetId?: number;

  @ApiPropertyOptional({
    description:
      'Set true for an invite link to the signup page. Provide exactly one of actionId, externalTargetId, or invite.',
  })
  @IsOptional()
  @IsBoolean()
  invite?: boolean;
}

export class CreateDuplicateShareLinkDto {
  @ApiPropertyOptional({
    description: 'Owning user. Provide exactly one of userId or campaignId.',
  })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({
    description:
      'Owning campaign. Provide exactly one of userId or campaignId.',
  })
  @IsOptional()
  @IsInt()
  campaignId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  actionId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  externalTargetId?: number;

  @ApiPropertyOptional({
    description:
      'Set true for an invite link to the signup page. Provide exactly one of actionId, externalTargetId, or invite.',
  })
  @IsOptional()
  @IsBoolean()
  invite?: boolean;

  @ApiPropertyOptional({
    description: 'Optional label to distinguish this duplicate at a glance.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class UpdateShareLinkLabelDto {
  @ApiPropertyOptional({
    description:
      'New label for the share URL. Send an empty string or omit to clear.',
  })
  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateInviteDuplicateDto {
  @ApiPropertyOptional({
    description: 'Optional label to distinguish this duplicate at a glance.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  communityId: number | null;
}

export class ShareUrlMineDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ type: String, nullable: true })
  label: string | null;

  @ApiProperty()
  duplicate: boolean;

  @ApiPropertyOptional()
  sid?: string;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ minimum: 0 })
  signupCount: number;

  @ApiProperty({
    enum: InviteAssignmentKind,
    enumName: 'InviteAssignmentKind',
  })
  assignmentKind: InviteAssignmentKind;

  @ApiProperty({ type: Number, nullable: true })
  communityId: number | null;

  constructor(input: ShareUrlWithSignupCount) {
    const assignment = getStoredInviteAssignment(input.shareUrl);
    const assignmentDetails = inviteAssignmentDetails(assignment);
    this.id = input.shareUrl.id;
    this.url = input.shareUrl.url;
    this.label = input.shareUrl.label ?? null;
    this.duplicate = input.shareUrl.duplicate;
    this.sid = input.shareUrl.sid;
    this.createdAt = input.shareUrl.createdAt;
    this.signupCount = input.signupCount;
    this.assignmentKind = assignmentDetails.assignmentKind;
    this.communityId = assignmentDetails.communityId;
  }
}

type ShareUrlAdminTarget = { id: number; name: string };

class ShareUrlAdminActionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  constructor(input: ShareUrlAdminTarget) {
    this.id = input.id;
    this.name = input.name;
  }
}

class ShareUrlAdminExternalTargetDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  constructor(input: ShareUrlAdminTarget) {
    this.id = input.id;
    this.name = input.name;
  }
}

export class ShareUrlAdminDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ShareUrlKind, enumName: 'ShareUrlKind' })
  kind: ShareUrlKind;

  @ApiPropertyOptional()
  sid?: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  duplicate: boolean;

  @ApiProperty({ type: String, nullable: true })
  label: string | null;

  @ApiProperty({ type: Number, nullable: true })
  userId: number | null;

  @ApiProperty({ type: Number, nullable: true })
  campaignId: number | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ minimum: 0 })
  signupCount: number;

  @ApiPropertyOptional({ type: () => ShareUrlAdminActionDto, nullable: true })
  @Type(() => ShareUrlAdminActionDto)
  action?: ShareUrlAdminActionDto | null;

  @ApiPropertyOptional({
    type: () => ShareUrlAdminExternalTargetDto,
    nullable: true,
  })
  @Type(() => ShareUrlAdminExternalTargetDto)
  externalTarget?: ShareUrlAdminExternalTargetDto | null;

  constructor(input: ShareUrlWithSignupCount) {
    this.id = input.shareUrl.id;
    this.kind = input.shareUrl.kind;
    this.sid = input.shareUrl.sid;
    this.url = input.shareUrl.url;
    this.duplicate = input.shareUrl.duplicate;
    this.label = input.shareUrl.label ?? null;
    this.userId = input.shareUrl.userId ?? null;
    this.campaignId = input.shareUrl.campaignId ?? null;
    this.createdAt = input.shareUrl.createdAt;
    this.signupCount = input.signupCount;
    this.action = input.shareUrl.action
      ? new ShareUrlAdminActionDto({
          id: input.shareUrl.action.id,
          name: input.shareUrl.action.name,
        })
      : null;
    this.externalTarget = input.shareUrl.externalTarget
      ? new ShareUrlAdminExternalTargetDto({
          id: input.shareUrl.externalTarget.id,
          name: input.shareUrl.externalTarget.name,
        })
      : null;
  }
}

export class ShareLinkDto {
  @ApiProperty()
  url: string;

  constructor(url: string) {
    this.url = url;
  }
}
