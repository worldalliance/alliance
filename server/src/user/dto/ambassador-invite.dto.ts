import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";
import { AmbassadorInviteGoal } from "../entities/ambassador-invite-goal.entity";

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
