import { ApiProperty, PickType } from "@nestjs/swagger";
import { Video } from "../entities/video.entity";

export class UploadVideoResponseDto extends PickType(Video, ["id", "key"]) {
  constructor(input: Video) {
    super();
    this.id = input.id;
    this.key = input.key;
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
]) {
  @ApiProperty({ isArray: true, type: VideoSegmentDto })
  segments: VideoSegmentDto[];

  @ApiProperty()
  totalOutputSize: number;

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
    this.segments = input.segments.map((s) => new VideoSegmentDto(s));
    this.totalOutputSize = input.totalOutputSize;
    this.dateCreated = input.video.dateCreated;
    this.dateUpdated = input.video.dateUpdated;
  }
}

export class ReplaceVideoResponseDto extends PickType(Video, ["id", "key"]) {
  constructor(input: Video) {
    super();
    this.id = input.id;
    this.key = input.key;
  }
}
