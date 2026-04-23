import { ApiProperty } from '@nestjs/swagger';

export class CommunityCompletedActionsCountDto {
  @ApiProperty({
    description:
      'Number of member action completions (user_completed activities) recorded for current members of this community',
  })
  completedCount!: number;
}
