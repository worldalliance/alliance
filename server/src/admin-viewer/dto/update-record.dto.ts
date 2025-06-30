import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateRecordDto {
  @ApiProperty({
    description: 'The primary key value of the record to update',
    example: '123',
  })
  @IsNotEmpty()
  primaryKeyValue: string | number;

  @ApiProperty({
    description: 'Object containing column names and their new values',
    example: { name: 'John Doe', email: 'john@example.com', active: true },
  })
  @IsNotEmpty()
  updates: Record<string, any>;
}

export class UpdateRecordResponseDto {
  @ApiProperty({
    description: 'Whether the update was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success or error message',
    example: 'Record updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'The updated record data',
    required: false,
  })
  @IsOptional()
  updatedRecord?: any;
}