import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class CreateRecordDto {
  @ApiProperty({
    description: 'Object containing column names and their values for the new record',
    example: { name: 'John Doe', email: 'john@example.com', active: true },
  })
  @IsNotEmpty()
  @IsObject()
  record: Record<string, any>;
}

export class CreateRecordResponseDto {
  @ApiProperty({
    description: 'Whether the insert was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success or error message',
    example: 'Record created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'The created record data',
    required: false,
  })
  @IsOptional()
  createdRecord?: any;
}
