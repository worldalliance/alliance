import { ApiProperty } from '@nestjs/swagger';

export class ContractStatusPointDto {
  @ApiProperty({ description: 'The date for this data point' })
  date: string;

  @ApiProperty({ description: 'Number of users with active contracts' })
  activeCount: number;

  @ApiProperty({
    description: 'Number of users who signed but are no longer active',
  })
  churnedCount: number;

  @ApiProperty({ description: 'Total users who ever signed up to this point' })
  totalEverSigned: number;
}
