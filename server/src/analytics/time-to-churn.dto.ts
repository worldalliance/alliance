import { ApiProperty } from "@nestjs/swagger";

export class TimeToChurnSampleDto {
  @ApiProperty({
    description:
      "Days between signing and the last completed action for churned members.",
  })
  daysToChurn: number;

  constructor(daysToChurn: number) {
    this.daysToChurn = daysToChurn;
  }
}
