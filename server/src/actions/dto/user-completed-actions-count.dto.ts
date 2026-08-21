import { ApiProperty } from "@nestjs/swagger";

export class UserCompletedActionsCountDto {
  @ApiProperty()
  completedCount!: number;

  constructor(completedCount: number) {
    this.completedCount = completedCount;
  }
}
