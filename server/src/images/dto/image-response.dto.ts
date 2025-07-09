import { ApiProperty, PickType } from '@nestjs/swagger';
import { Image } from '../entities/image.entity';

export class ImageResponseDto extends PickType(Image, ['key', 'id']) {}

export class ImageDataDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  contents: string;
}

export class DeleteImageResponseDto {
  @ApiProperty({ type: Boolean })
  deleted: boolean;
}
