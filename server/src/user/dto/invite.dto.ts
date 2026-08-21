import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsArray,
  IsDateString,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CommunityDto } from "src/community/dto/community.dto";
import { CommunityInvite } from "src/community/entities/community-invite.entity";
import { getImageSource } from "src/images/images.service";
import { type PaginatedList, PaginatedListDto } from "src/utils/pagination.dto";
import { AmbassadorInviteGoal } from "../entities/ambassador-invite-goal.entity";
import { AmbassadorProgramInteraction } from "../entities/ambassador-program-interaction.entity";
import { AmbassadorProgramMember } from "../entities/ambassador-program-member.entity";
import { OnetimeInvite } from "../entities/onetime-invite.entity";
import { User } from "../entities/user.entity";
import { ProfileDto, UserDto } from "./user.dto";

export class CreateOnetimeInviteDto extends PickType(OnetimeInvite, [
  "invitee",
  "info",
]) {
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
    this.community = new CommunityDto(communityInvite.community);
    this.invitedUser = communityInvite.invitedUser
      ? new ProfileDto(communityInvite.invitedUser)
      : undefined;
    this.invitingUser = communityInvite.invitingUser
      ? new ProfileDto(communityInvite.invitingUser)
      : undefined;
  }
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
  @ApiPropertyOptional({ type: CommunityDto })
  @Type(() => CommunityDto)
  community?: CommunityDto | null;

  @ApiPropertyOptional({ type: ProfileDto })
  @Type(() => ProfileDto)
  invitingUser?: ProfileDto;

  @ApiPropertyOptional({ type: ProfileDto })
  @Type(() => ProfileDto)
  invitedUser?: ProfileDto;

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
    this.displayName = input.anonymous ? "Someone" : input.name;
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
  "inviteeDescription",
]) {
  @ApiPropertyOptional()
  @IsOptional()
  invitingUserId?: number;

  @ApiProperty()
  @Allow()
  communityId: number;
}

export class CreateAmbassadorInviteGoalDto extends PickType(
  AmbassadorInviteGoal,
  ["targetSuccessfulRecruits"],
) {
  @ApiProperty({ type: String, format: "date-time" })
  @IsDateString()
  startAt: string;

  @ApiProperty({ type: String, format: "date-time" })
  @IsDateString()
  dueAt: string;
}

export class UpdateAmbassadorInviteGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  targetSuccessfulRecruits?: number;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class AmbassadorInviteGoalDto extends PickType(AmbassadorInviteGoal, [
  "id",
  "targetSuccessfulRecruits",
  "startAt",
  "dueAt",
  "createdAt",
  "updatedAt",
]) {
  constructor(goal: AmbassadorInviteGoal) {
    super();
    this.id = goal.id;
    this.targetSuccessfulRecruits = goal.targetSuccessfulRecruits;
    this.startAt = goal.startAt;
    this.dueAt = goal.dueAt;
    this.createdAt = goal.createdAt;
    this.updatedAt = goal.updatedAt;
  }
}

export type AmbassadorInviteStats = {
  totalInvitesSent: number;
  totalAcceptedInvites: number;
  totalSuccessfulRecruits: number;
  goalSuccessfulRecruits: number;
};

export class AmbassadorInviteStatsDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  totalInvitesSent: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  totalAcceptedInvites: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  totalSuccessfulRecruits: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  goalSuccessfulRecruits: number;

  constructor(stats: AmbassadorInviteStats) {
    this.totalInvitesSent = stats.totalInvitesSent;
    this.totalAcceptedInvites = stats.totalAcceptedInvites;
    this.totalSuccessfulRecruits = stats.totalSuccessfulRecruits;
    this.goalSuccessfulRecruits = stats.goalSuccessfulRecruits;
  }
}

export type AmbassadorInviteGoalWithStats = {
  goal: AmbassadorInviteGoal;
  stats: AmbassadorInviteStats;
};

export class AmbassadorInviteGoalWithStatsDto {
  @ApiProperty({ type: AmbassadorInviteGoalDto })
  @Type(() => AmbassadorInviteGoalDto)
  goal: AmbassadorInviteGoalDto;

  @ApiProperty({ type: AmbassadorInviteStatsDto })
  @Type(() => AmbassadorInviteStatsDto)
  stats: AmbassadorInviteStatsDto;

  constructor(input: AmbassadorInviteGoalWithStats) {
    this.goal = new AmbassadorInviteGoalDto(input.goal);
    this.stats = new AmbassadorInviteStatsDto(input.stats);
  }
}

export type AmbassadorInviteProjectionPoint = {
  date: string;
  projectedSuccessfulRecruits: number;
};

export class AmbassadorInviteProjectionPointDto {
  @ApiProperty({ type: String, format: "date-time" })
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  projectedSuccessfulRecruits: number;

  constructor(input: AmbassadorInviteProjectionPoint) {
    this.date = input.date;
    this.projectedSuccessfulRecruits = input.projectedSuccessfulRecruits;
  }
}

export type AmbassadorInviteProjection = {
  generatedAt: string;
  points: AmbassadorInviteProjectionPoint[];
};

export class AmbassadorInviteProjectionDto {
  @ApiProperty({ type: String, format: "date-time" })
  @IsDateString()
  generatedAt: string;

  @ApiProperty({ type: AmbassadorInviteProjectionPointDto, isArray: true })
  @Type(() => AmbassadorInviteProjectionPointDto)
  @IsArray()
  @ValidateNested({ each: true })
  points: AmbassadorInviteProjectionPointDto[];

  constructor(input: AmbassadorInviteProjection) {
    this.generatedAt = input.generatedAt;
    this.points = input.points.map(
      (point) => new AmbassadorInviteProjectionPointDto(point),
    );
  }
}

export type AmbassadorInviteDashboard = {
  goals: AmbassadorInviteGoalWithStats[];
  projection: AmbassadorInviteProjection;
  stats: AmbassadorInviteStats;
};

export class AmbassadorInviteDashboardDto {
  @ApiProperty({ type: AmbassadorInviteGoalWithStatsDto, isArray: true })
  @Type(() => AmbassadorInviteGoalWithStatsDto)
  goals: AmbassadorInviteGoalWithStatsDto[];

  @ApiProperty({ type: AmbassadorInviteStatsDto })
  @Type(() => AmbassadorInviteStatsDto)
  stats: AmbassadorInviteStatsDto;

  @ApiProperty({ type: AmbassadorInviteProjectionDto })
  @Type(() => AmbassadorInviteProjectionDto)
  projection: AmbassadorInviteProjectionDto;

  constructor(input: AmbassadorInviteDashboard) {
    this.goals = input.goals.map(
      (goal) => new AmbassadorInviteGoalWithStatsDto(goal),
    );
    this.stats = new AmbassadorInviteStatsDto(input.stats);
    this.projection = new AmbassadorInviteProjectionDto(input.projection);
  }
}

export class UpsertAmbassadorProgramMemberDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiPropertyOptional()
  @IsOptional()
  invited?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  activeParticipant?: boolean;
}

export class UpdateAmbassadorProgramMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  invited?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  activeParticipant?: boolean;
}

export class CreateAmbassadorProgramInteractionDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ type: String, format: "date" })
  @IsDateString()
  interactionDate: string;
}

export class AmbassadorProgramInteractionDto extends PickType(
  AmbassadorProgramInteraction,
  ["id", "text", "interactionDate", "createdAt"],
) {
  constructor(interaction: AmbassadorProgramInteraction) {
    super();
    this.id = interaction.id;
    this.text = interaction.text;
    this.interactionDate = interaction.interactionDate;
    this.createdAt = interaction.createdAt;
  }
}

export type AmbassadorProgramInviteStats = {
  totals: AmbassadorInviteStats;
  currentGoal?: AmbassadorInviteGoalWithStats;
  pastGoals: AmbassadorInviteGoalWithStats[];
  upcomingGoals: AmbassadorInviteGoalWithStats[];
};

export class AmbassadorProgramInviteStatsDto {
  @ApiProperty({ type: AmbassadorInviteStatsDto })
  @Type(() => AmbassadorInviteStatsDto)
  @ValidateNested()
  totals: AmbassadorInviteStatsDto;

  @ApiPropertyOptional({ type: AmbassadorInviteGoalWithStatsDto })
  @Type(() => AmbassadorInviteGoalWithStatsDto)
  @IsOptional()
  @ValidateNested()
  currentGoal?: AmbassadorInviteGoalWithStatsDto;

  @ApiProperty({ type: AmbassadorInviteGoalWithStatsDto, isArray: true })
  @Type(() => AmbassadorInviteGoalWithStatsDto)
  @IsArray()
  @ValidateNested({ each: true })
  pastGoals: AmbassadorInviteGoalWithStatsDto[];

  @ApiProperty({ type: AmbassadorInviteGoalWithStatsDto, isArray: true })
  @Type(() => AmbassadorInviteGoalWithStatsDto)
  @IsArray()
  @ValidateNested({ each: true })
  upcomingGoals: AmbassadorInviteGoalWithStatsDto[];

  constructor(input: AmbassadorProgramInviteStats) {
    this.totals = new AmbassadorInviteStatsDto(input.totals);
    this.currentGoal = input.currentGoal
      ? new AmbassadorInviteGoalWithStatsDto(input.currentGoal)
      : undefined;
    this.pastGoals = input.pastGoals.map(
      (goal) => new AmbassadorInviteGoalWithStatsDto(goal),
    );
    this.upcomingGoals = input.upcomingGoals.map(
      (goal) => new AmbassadorInviteGoalWithStatsDto(goal),
    );
  }
}

export type AmbassadorProgramMemberWithInviteStats = AmbassadorProgramMember & {
  inviteStats?: AmbassadorProgramInviteStats;
};

export class AmbassadorProgramMemberDto extends PickType(
  AmbassadorProgramMember,
  ["id", "userId", "invited", "activeParticipant", "createdAt", "updatedAt"],
) {
  @ApiProperty({ type: UserDto })
  @Type(() => UserDto)
  @ValidateNested()
  user: UserDto;

  @ApiProperty({ type: AmbassadorProgramInteractionDto, isArray: true })
  @Type(() => AmbassadorProgramInteractionDto)
  @IsArray()
  @ValidateNested({ each: true })
  interactions: AmbassadorProgramInteractionDto[];

  @ApiPropertyOptional({ type: AmbassadorProgramInviteStatsDto })
  @Type(() => AmbassadorProgramInviteStatsDto)
  @IsOptional()
  @ValidateNested()
  inviteStats?: AmbassadorProgramInviteStatsDto;

  constructor(member: AmbassadorProgramMemberWithInviteStats) {
    super();
    this.id = member.id;
    this.userId = member.userId;
    this.invited = member.invited;
    this.activeParticipant = member.activeParticipant;
    this.createdAt = member.createdAt;
    this.updatedAt = member.updatedAt;
    this.user = new UserDto(member.user);
    this.interactions = [...(member.interactions ?? [])]
      .sort(
        (a, b) =>
          b.interactionDate.localeCompare(a.interactionDate) || b.id - a.id,
      )
      .map((interaction) => new AmbassadorProgramInteractionDto(interaction));
    this.inviteStats = member.inviteStats
      ? new AmbassadorProgramInviteStatsDto(member.inviteStats)
      : undefined;
  }
}

export type AmbassadorProgramDashboard = {
  members: AmbassadorProgramMemberWithInviteStats[];
  projection: AmbassadorInviteProjection;
};

export class AmbassadorProgramDashboardDto {
  @ApiProperty({ type: AmbassadorProgramMemberDto, isArray: true })
  @Type(() => AmbassadorProgramMemberDto)
  @IsArray()
  @ValidateNested({ each: true })
  members: AmbassadorProgramMemberDto[];

  @ApiProperty({ type: AmbassadorInviteProjectionDto })
  @Type(() => AmbassadorInviteProjectionDto)
  @IsDefined()
  @ValidateNested()
  projection: AmbassadorInviteProjectionDto;

  constructor(input: AmbassadorProgramDashboard) {
    this.members = input.members.map(
      (member) => new AmbassadorProgramMemberDto(member),
    );
    this.projection = new AmbassadorInviteProjectionDto(input.projection);
  }
}
