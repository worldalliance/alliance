import { ApiProperty } from '@nestjs/swagger';
import { ColumnDataType } from './column-type.enum';

export class CellValueDto {
  @ApiProperty({
    description: 'The raw value from the database',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object' },
    ],
    nullable: true,
  })
  value: string | number | boolean | object | null;

  @ApiProperty({
    enum: ColumnDataType,
    description: 'The semantic type of this value',
  })
  type: ColumnDataType;

  @ApiProperty({
    description: 'Formatted display value for the frontend',
    required: false,
  })
  displayValue?: string;

  @ApiProperty({
    description: 'Target table for relation columns',
    required: false,
  })
  relationTarget?: string;
}