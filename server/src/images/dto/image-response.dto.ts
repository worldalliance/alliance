import { ApiProperty } from '@nestjs/swagger';

export class ImageResponseDto {
  @ApiProperty({
    description: 'The filename of the image',
    example: '1234567890.jpg',
  })
  filename: string;
}

export class ImageDataDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  contents: string;
}
