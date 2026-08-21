import { ApiProperty } from "@nestjs/swagger";

export type MemberReliabilityRate = {
  assignedCount: number;
  completedCount: number;
  completionRate: number;
};

export type MemberReliabilityWindow = {
  weeks: number;
  firstWeek: MemberReliabilityRate;
  fourthWeekOrLater: MemberReliabilityRate;
};

export class MemberReliabilityRateDto {
  @ApiProperty()
  assignedCount: number;

  @ApiProperty()
  completedCount: number;

  @ApiProperty()
  completionRate: number;

  constructor(input: MemberReliabilityRate) {
    this.assignedCount = input.assignedCount;
    this.completedCount = input.completedCount;
    this.completionRate = input.completionRate;
  }
}

export class MemberReliabilityWindowDto {
  @ApiProperty()
  weeks: number;

  @ApiProperty({ type: () => MemberReliabilityRateDto })
  firstWeek: MemberReliabilityRateDto;

  @ApiProperty({ type: () => MemberReliabilityRateDto })
  fourthWeekOrLater: MemberReliabilityRateDto;

  constructor(input: MemberReliabilityWindow) {
    this.weeks = input.weeks;
    this.firstWeek = new MemberReliabilityRateDto(input.firstWeek);
    this.fourthWeekOrLater = new MemberReliabilityRateDto(
      input.fourthWeekOrLater,
    );
  }
}
