import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Res,
  StreamableFile,
  Param,
  Inject,
} from '@nestjs/common';
import { ImagesService } from './images.service';
import { basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { ImageMimeTypeValidator } from './image-validator.pipe';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { ApiBody, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { ImageResponseDto } from './dto/image-response.dto';

const allowedTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

class UploadImageDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  image: Express.Multer.File;
}

@ApiOkResponse({ type: ImageResponseDto })
@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    @Inject('S3_CLIENT') private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!; // TODO: separate dev bucket

  @Post('upload')
  @ApiOkResponse({ type: String })
  @ApiBody({ type: UploadImageDto })
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 1024 }),
          new ImageMimeTypeValidator(allowedTypes),
        ],
      }),
    )
    image: Express.Multer.File,
  ) {
    const ext = extname(image.originalname);
    const key = `uploads/${uuidv4()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: image.buffer,
        ContentType: image.mimetype,
      }),
    );

    const imageEntity = await this.imagesService.createImage({
      key,
      mime: image.mimetype,
      size: image.size,
    });

    return { id: imageEntity.id, key };
  }

  @Get(':key')
  @ApiOkResponse({ type: StreamableFile })
  async getImage(
    @Param('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { Body, ContentType } = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    res.set({
      'Content-Type': ContentType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${basename(key)}"`,
    });
    console.log('returning image for ', key);

    return new StreamableFile(Body as Readable);
  }

  @Delete(':id')
  async deleteImage(@Param('id') id: number) {
    const img = await this.imagesService.getImage(id);
    if (!img) throw new NotFoundException();

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: img.key }),
    );
    await this.imagesService.deleteImage(id);
    return { deleted: true };
  }
}
