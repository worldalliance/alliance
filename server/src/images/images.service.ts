import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { Image } from './entities/image.entity';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private imageRepository: Repository<Image>,
    @Inject('S3_CLIENT') private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!; // TODO: separate dev bucket

  async getImages(): Promise<Image[]> {
    return this.imageRepository.find();
  }

  async createImage(
    image: Pick<Image, 'key' | 'mime' | 'size'>,
  ): Promise<Image> {
    return this.imageRepository.save(image);
  }

  async getImage(id: number): Promise<Image | null> {
    const image = await this.imageRepository.findOneBy({ id });
    if (!image) {
      return null;
    }
    return image;
  }

  async deleteImage(id: number): Promise<boolean> {
    const image = await this.getImage(id);

    if (!image) {
      return false;
    }
    await this.imageRepository.delete(id);

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: image.key }),
    ); //TODO: untested

    return true;
  }

  async processAndUploadProfileImage(image: string): Promise<string> {
    const spliced = image.substring(image.indexOf(',') + 1);
    const imgBuffer = Buffer.from(spliced, 'base64');
    const processed = await sharp(imgBuffer)
      .rotate()
      .resize({ width: 400 })
      .webp({ effort: 3 })
      .toBuffer();

    const key = `${Date.now()}.webp`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed,
        ContentType: 'image/webp',
      }),
    );

    return key;
  }

  async uploadImage(
    file: string,
    resize?: { width: number; height: number },
  ): Promise<string> {
    const spliced = file.substring(file.indexOf(',') + 1);
    const imgBuffer = Buffer.from(spliced, 'base64');
    let processed = await sharp(imgBuffer).rotate().webp({ effort: 3 });

    if (resize) {
      processed = await processed.resize(resize.width, resize.height, {
        fit: 'inside',
      });
    }
    try {
      const buffer = await processed.toBuffer();

      const key = `${Date.now()}.webp`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/webp',
        }),
      );
      return key;
    } catch {
      throw new BadRequestException(
        'Failed to process image - try a standard image format',
      );
    }
  }
}

export function getImageSource(string: string) {
  if (typeof string !== 'string') {
    return '';
  }

  if (string.startsWith('http')) {
    return string; // TODO
  }

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging'
  ) {
    if (
      process.env.USE_CLOUDFRONT === 'true' &&
      process.env.CLOUDFRONT_DOMAIN
    ) {
      return `https://${process.env.CLOUDFRONT_DOMAIN}/${string}`;
    }
    return `${process.env.APP_URL}/api/images/${string}`;
  } else {
    return `http://localhost:3005/images/${string}`;
  }
}
