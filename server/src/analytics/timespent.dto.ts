import { ApiProperty } from "@nestjs/swagger";

export type TimeSpentForUser = {
  userId: number;
  timeSpent: number;
};

export class TimeSpentForUserDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  timeSpent: number;

  constructor(input: TimeSpentForUser) {
    this.userId = input.userId;
    this.timeSpent = input.timeSpent;
  }
}
