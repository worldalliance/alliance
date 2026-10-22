import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { WithRelations } from "src/utils/Repository";
import { AmbassadorProgramInteraction } from "../entities/ambassador-program-interaction.entity";
import { AmbassadorProgramMember } from "../entities/ambassador-program-member.entity";
import {
  type AmbassadorInviteGoalWithStats,
  AmbassadorInviteGoalWithStatsDto,
  type AmbassadorInviteProjection,
  AmbassadorInviteProjectionDto,
  type AmbassadorInviteStats,
  AmbassadorInviteStatsDto,
} from "./ambassador-invite.dto";
import { UserDto } from "./user.dto";

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

export type AmbassadorProgramMemberWithUser = WithRelations<
  AmbassadorProgramMember,
  { user: true }
>;

export type AmbassadorProgramMemberWithInviteStats =
  AmbassadorProgramMemberWithUser & {
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
