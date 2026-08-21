import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Video } from "../entities/video.entity";

export class UploadVideoResponseDto extends PickType(Video, [
  "id",
  "key",
  "status",
]) {
  constructor(input: Video) {
    super();
    this.id = input.id;
    this.key = input.key;
    this.status = input.status;
  }
}

export class VideoStatusResponseDto extends PickType(Video, [
  "id",
  "key",
  "status",
  "duration",
]) {
  constructor(input: Video) {
    super();
    this.id = input.id;
    this.key = input.key;
    this.status = input.status;
    this.duration = input.duration;
  }
}

export class DeleteVideoResponseDto {
  @ApiProperty({ type: Boolean })
  deleted: boolean;

  constructor(deleted: boolean) {
    this.deleted = deleted;
  }
}

export class VideoListItemDto extends PickType(Video, [
  "id",
  "key",
  "originalFilename",
  "mime",
  "size",
  "status",
  "duration",
]) {
  @ApiProperty()
  dateCreated: Date;

  @ApiProperty()
  dateUpdated: Date;

  constructor(input: Video) {
    super();
    this.id = input.id;
    this.key = input.key;
    this.originalFilename = input.originalFilename;
    this.mime = input.mime;
    this.size = input.size;
    this.status = input.status;
    this.duration = input.duration;
    this.dateCreated = input.dateCreated;
    this.dateUpdated = input.dateUpdated;
  }
}

export class VideoListResponseDto {
  @ApiProperty({ isArray: true, type: VideoListItemDto })
  videos: VideoListItemDto[];

  constructor(videos: Video[]) {
    this.videos = videos.map((v) => new VideoListItemDto(v));
  }
}

export type VideoSegment = { filename: string; size: number; key: string };

export class VideoSegmentDto {
  @ApiProperty()
  filename: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  key: string;

  constructor(input: VideoSegment) {
    this.filename = input.filename;
    this.size = input.size;
    this.key = input.key;
  }
}

export type VideoProcessingInfo = {
  codec: string;
  preset: string;
  crf: number;
  maxrate: string;
  bufsize: string;
  scale: string;
  audioCodec: string;
  audioBitrate: string;
  hlsTime: number;
};

export class VideoProcessingInfoDto {
  @ApiProperty()
  codec: string;

  @ApiProperty()
  preset: string;

  @ApiProperty()
  crf: number;

  @ApiProperty()
  maxrate: string;

  @ApiProperty()
  bufsize: string;

  @ApiProperty()
  scale: string;

  @ApiProperty()
  audioCodec: string;

  @ApiProperty()
  audioBitrate: string;

  @ApiProperty()
  hlsTime: number;

  constructor(input: VideoProcessingInfo) {
    this.codec = input.codec;
    this.preset = input.preset;
    this.crf = input.crf;
    this.maxrate = input.maxrate;
    this.bufsize = input.bufsize;
    this.scale = input.scale;
    this.audioCodec = input.audioCodec;
    this.audioBitrate = input.audioBitrate;
    this.hlsTime = input.hlsTime;
  }
}

export type VideoDetailResponse = {
  video: Video;
  segments: VideoSegment[];
  totalOutputSize: number;
};

export class VideoDetailResponseDto extends PickType(Video, [
  "id",
  "key",
  "originalFilename",
  "mime",
  "size",
  "status",
  "duration",
]) {
  @ApiProperty({ isArray: true, type: VideoSegmentDto })
  segments: VideoSegmentDto[];

  @ApiProperty()
  totalOutputSize: number;

  @ApiPropertyOptional({ type: VideoProcessingInfoDto })
  processingInfo?: VideoProcessingInfoDto;

  @ApiProperty()
  dateCreated: Date;

  @ApiProperty()
  dateUpdated: Date;

  constructor(input: VideoDetailResponse) {
    super();
    this.id = input.video.id;
    this.key = input.video.key;
    this.originalFilename = input.video.originalFilename;
    this.mime = input.video.mime;
    this.size = input.video.size;
    this.status = input.video.status;
    this.duration = input.video.duration;
    this.segments = input.segments.map((s) => new VideoSegmentDto(s));
    this.totalOutputSize = input.totalOutputSize;
    this.processingInfo = input.video.processingInfo
      ? new VideoProcessingInfoDto(
          input.video.processingInfo as unknown as VideoProcessingInfo,
        )
      : undefined;
    this.dateCreated = input.video.dateCreated;
    this.dateUpdated = input.video.dateUpdated;
  }
}

export class ReplaceVideoResponseDto extends PickType(Video, [
  "id",
  "key",
  "status",
]) {
  constructor(input: Video) {
    super();
    this.id = input.id;
    this.key = input.key;
    this.status = input.status;
  }
}
