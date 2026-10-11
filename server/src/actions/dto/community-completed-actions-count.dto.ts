import { ApiProperty } from "@nestjs/swagger";

export class CommunityCompletedActionsCountDto {
  @ApiProperty({
    description:
      "Number of (member, action) pairs among current members of this community whose latest completion or withdrawal is a completion",
  })
  completedCount!: number;

  constructor(completedCount: number) {
    this.completedCount = completedCount;
  }
}
