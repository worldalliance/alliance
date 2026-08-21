import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export type PlatformTenureCohortActionStats = {
  actionId: number;
  actionName: string;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  memberActionStartDate: Date;
  memberActionEndDate?: Date;
};

export type PlatformTenureCohortStats = {
  weeksOnPlatform: number;
  cohortSize: number;
  activeCount: number;
  churnedCount: number;
  churnRate: number;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  actions: PlatformTenureCohortActionStats[];
};

export class PlatformTenureCohortActionStatsDto {
  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty()
  assignedCount: number;

  @ApiProperty()
  completedCount: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  memberActionStartDate: Date;

  @ApiPropertyOptional()
  memberActionEndDate?: Date;

  constructor(input: PlatformTenureCohortActionStats) {
    this.actionId = input.actionId;
    this.actionName = input.actionName;
    this.assignedCount = input.assignedCount;
    this.completedCount = input.completedCount;
    this.completionRate = input.completionRate;
    this.memberActionStartDate = input.memberActionStartDate;
    this.memberActionEndDate = input.memberActionEndDate;
  }
}

export class PlatformTenureCohortStatsDto {
  @ApiProperty()
  weeksOnPlatform: number;

  @ApiProperty()
  cohortSize: number;

  @ApiProperty()
  activeCount: number;

  @ApiProperty()
  churnedCount: number;

  @ApiProperty()
  churnRate: number;

  @ApiProperty()
  assignedCount: number;

  @ApiProperty()
  completedCount: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty({
    type: () => PlatformTenureCohortActionStatsDto,
    isArray: true,
  })
  actions: PlatformTenureCohortActionStatsDto[];

  constructor(input: PlatformTenureCohortStats) {
    this.weeksOnPlatform = input.weeksOnPlatform;
    this.cohortSize = input.cohortSize;
    this.activeCount = input.activeCount;
    this.churnedCount = input.churnedCount;
    this.churnRate = input.churnRate;
    this.assignedCount = input.assignedCount;
    this.completedCount = input.completedCount;
    this.completionRate = input.completionRate;
    this.actions = input.actions.map(
      (action) => new PlatformTenureCohortActionStatsDto(action),
    );
  }
}
