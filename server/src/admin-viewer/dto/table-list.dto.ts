import { ApiProperty } from '@nestjs/swagger';

export class TableMetadataDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  entityName: string;

  @ApiProperty()
  recordCount: number;

  @ApiProperty()
  primaryKey: string;
}

export class TableListDto {
  @ApiProperty({ type: [TableMetadataDto] })
  tables: TableMetadataDto[];
}