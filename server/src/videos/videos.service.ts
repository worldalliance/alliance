import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Video } from './entities/video.entity';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @Inject('S3_CLIENT') private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!;

  private getContentType(filename: string): string {
    if (filename.endsWith('.m3u8')) {
      return 'application/vnd.apple.mpegurl';
    } else if (filename.endsWith('.vtt')) {
      return 'text/vtt';
    }
    return 'video/MP2T';
  }

  async uploadVideo(files: Express.Multer.File[]): Promise<Video> {
    const key = `videos/${Date.now()}`;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const playlist = files.find(
      (f) =>
        f.originalname.endsWith('.m3u8') && !f.originalname.includes('_vtt'),
    );
    const video = await this.videoRepository.save(
      this.videoRepository.create({
        key,
        originalFilename: playlist?.originalname ?? files[0].originalname,
        mime: 'application/vnd.apple.mpegurl',
        size: totalSize,
        status: 'ready',
      }),
    );

    await Promise.all(
      files.map(async (file) => {
        const filename = file.originalname;

        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: `${video.key}/${filename}`,
            Body: file.buffer,
            ContentType: this.getContentType(filename),
          }),
        );
      }),
    );

    return video;
  }

  async getVideo(id: number): Promise<Video | null> {
    return this.videoRepository.findOneBy({ id });
  }

  async listVideos(): Promise<Video[]> {
    return this.videoRepository.find({ order: { dateCreated: 'DESC' } });
  }

  async getVideoDetails(id: number): Promise<{
    video: Video;
    segments: { filename: string; size: number; key: string }[];
    totalOutputSize: number;
  } | null> {
    const video = await this.videoRepository.findOneBy({ id });
    if (!video) return null;

    const listResult = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${video.key}/`,
      }),
    );

    const segments = (listResult.Contents ?? []).map((obj) => ({
      filename: obj.Key!.split('/').pop()!,
      size: obj.Size ?? 0,
      key: obj.Key!,
    }));

    const totalOutputSize = segments.reduce((sum, seg) => sum + seg.size, 0);

    return { video, segments, totalOutputSize };
  }

  async replaceVideoContent(
    id: number,
    files: Express.Multer.File[],
  ): Promise<Video | null> {
    const video = await this.videoRepository.findOneBy({ id });
    if (!video) return null;

    // Delete existing S3 objects under this video's key prefix
    const listResult = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${video.key}/`,
      }),
    );

    if (listResult.Contents && listResult.Contents.length > 0) {
      await Promise.all(
        listResult.Contents.map((obj) =>
          this.s3.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: obj.Key!,
            }),
          ),
        ),
      );
    }

    // Upload new files preserving their original filenames
    await Promise.all(
      files.map(async (file) => {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: `${video.key}/${file.originalname}`,
            Body: file.buffer,
            ContentType: this.getContentType(file.originalname),
          }),
        );
      }),
    );

    await this.videoRepository.update(video.id, {
      status: 'ready',
      processingInfo: null,
    });
    return this.videoRepository.findOneBy({ id });
  }

  async deleteVideo(id: number): Promise<boolean> {
    const video = await this.getVideo(id);
    if (!video) return false;

    // Delete all S3 objects under the video's key prefix
    const listResult = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${video.key}/`,
      }),
    );

    if (listResult.Contents && listResult.Contents.length > 0) {
      await Promise.all(
        listResult.Contents.map((obj) =>
          this.s3.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: obj.Key!,
            }),
          ),
        ),
      );
    }

    await this.videoRepository.delete(id);
    return true;
  }
}

export function getVideoSource(key: string): string {
  if (typeof key !== 'string') return '';

  if (key.startsWith('http')) return key;

  if (process.env.USE_CLOUDFRONT === 'true' && process.env.CLOUDFRONT_DOMAIN) {
    return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
  }

  return key;
}
