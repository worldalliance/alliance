import { ApiProperty } from '@nestjs/swagger';
import { Image } from '../entities/image.entity';
import { PickType } from '@nestjs/mapped-types';

export class ImageResponseDto extends PickType(Image, ['filename', 'id']) {}

export class ImageDataDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  contents: string;
}

export class DeleteImageResponseDto {
  @ApiProperty({ type: Boolean })
  deleted: boolean;
}
