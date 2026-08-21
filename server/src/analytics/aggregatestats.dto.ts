import { ApiProperty } from "@nestjs/swagger";

export class AggregateStatsDto {
  @ApiProperty()
  signedUsers: number;

  constructor(input: AggregateStats) {
    this.signedUsers = input.signedUsers;
  }
}

export type AggregateStats = {
  signedUsers: number;
};
