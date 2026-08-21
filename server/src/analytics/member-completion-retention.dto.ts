import { ApiProperty } from "@nestjs/swagger";

export type MemberCompletionRetentionActionSummary = {
  actionId: number;
  actionName: string;
  memberCount: number;
};

export type MemberCompletionRetentionPoint = {
  weekIndex: number;
  actionIndex: number;
  actionStartDate: string;
  completionRate: number;
  joinedCount: number;
  completedCount: number;
  weekCompletionRate: number;
  weekJoinedCount: number;
  weekCompletedCount: number;
  actions: MemberCompletionRetentionActionSummary[];
};

export type MemberCompletionRetentionCohort = {
  cohortStart: string;
  cohortSize: number;
  points: MemberCompletionRetentionPoint[];
};

export class MemberCompletionRetentionActionSummaryDto {
  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty()
  memberCount: number;

  constructor(input: MemberCompletionRetentionActionSummary) {
    this.actionId = input.actionId;
    this.actionName = input.actionName;
    this.memberCount = input.memberCount;
  }
}

export class MemberCompletionRetentionPointDto {
  @ApiProperty()
  weekIndex: number;

  @ApiProperty()
  actionIndex: number;

  @ApiProperty()
  actionStartDate: string;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  joinedCount: number;

  @ApiProperty()
  completedCount: number;

  @ApiProperty()
  weekCompletionRate: number;

  @ApiProperty()
  weekJoinedCount: number;

  @ApiProperty()
  weekCompletedCount: number;

  @ApiProperty({
    type: () => MemberCompletionRetentionActionSummaryDto,
    isArray: true,
  })
  actions: MemberCompletionRetentionActionSummaryDto[];

  constructor(input: MemberCompletionRetentionPoint) {
    this.weekIndex = input.weekIndex;
    this.actionIndex = input.actionIndex;
    this.actionStartDate = input.actionStartDate;
    this.completionRate = input.completionRate;
    this.joinedCount = input.joinedCount;
    this.completedCount = input.completedCount;
    this.weekCompletionRate = input.weekCompletionRate;
    this.weekJoinedCount = input.weekJoinedCount;
    this.weekCompletedCount = input.weekCompletedCount;
    this.actions = input.actions.map(
      (action) => new MemberCompletionRetentionActionSummaryDto(action),
    );
  }
}

export class MemberCompletionRetentionCohortDto {
  @ApiProperty()
  cohortStart: string;

  @ApiProperty()
  cohortSize: number;

  @ApiProperty({ type: () => MemberCompletionRetentionPointDto, isArray: true })
  points: MemberCompletionRetentionPointDto[];

  constructor(input: MemberCompletionRetentionCohort) {
    this.cohortStart = input.cohortStart;
    this.cohortSize = input.cohortSize;
    this.points = input.points.map(
      (point) => new MemberCompletionRetentionPointDto(point),
    );
  }
}
