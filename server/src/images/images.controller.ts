import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Response } from 'express';
import { basename } from 'path';
import { Readable } from 'stream';
import { getImageSource, ImagesService } from './images.service';
import { UploadImageResponseDto } from './dto/image-response.dto';

export class BodyDto {
  @IsNotEmpty()
  file: string;
}

@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    @Inject('S3_CLIENT') private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!;

  @Get(':key')
  @ApiOkResponse({ type: StreamableFile })
  async getImage(
    @Param('key') key: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!key) throw new NotFoundException();

    const ac = new AbortController();

    res.on('close', () => ac.abort());
    res.on('error', () => ac.abort());

    try {
      const out = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: ac.signal },
      );

      const body = out.Body as Readable | undefined;
      if (!body) throw new NotFoundException();

      res.setHeader(
        'Content-Type',
        out.ContentType ?? 'application/octet-stream',
      );
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${basename(key)}"`,
      );
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      body.on('error', () => {
        try {
          body.destroy();
        } catch {}
        if (!res.headersSent) res.status(500);
        res.end();
      });

      body.pipe(res);
    } catch (err) {
      if (err?.name === 'AbortError') return;

      if (process.env.NODE_ENV !== 'development') {
        console.error('Error getting image:', err);
      }
      throw new NotFoundException();
    }
  }

  @Delete(':id')
  @ApiOkResponse()
  async deleteImage(@Param('id') id: number) {
    const img = await this.imagesService.getImage(id);
    if (!img) throw new NotFoundException();

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: img.key }),
    );
    await this.imagesService.deleteImage(id);
    return { deleted: true };
  }

  @Post('/uploadImage')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({ type: UploadImageResponseDto })
  async uploadImage(@Body() body) {
    const key = await this.imagesService.uploadImage(body.file);
    return { url: getImageSource(key), key };
  }
}
