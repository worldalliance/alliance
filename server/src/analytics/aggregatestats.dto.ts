import { ApiProperty } from '@nestjs/swagger';

export class AggregateStatsDto {
  @ApiProperty()
  signedUsers: number;
}
