import { ApiProperty } from '@nestjs/swagger';

export class MemberCompletionRetentionPointDto {
  @ApiProperty()
  weekIndex: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  joinedCount: number;

  @ApiProperty()
  completedCount: number;
}

export class MemberCompletionRetentionCohortDto {
  @ApiProperty()
  cohortStart: string;

  @ApiProperty()
  cohortSize: number;

  @ApiProperty({ type: () => [MemberCompletionRetentionPointDto] })
  points: MemberCompletionRetentionPointDto[];
}
