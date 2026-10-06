import { S3Client } from "@aws-sdk/client-s3";
import {
  applyDecorators,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOkResponse } from "@nestjs/swagger";
import type { Response } from "express";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { pipeS3Object } from "src/s3/pipe-s3-object";
import {
  DeleteVideoResponseDto,
  ReplaceVideoResponseDto,
  UploadVideoResponseDto,
  VideoDetailResponseDto,
  VideoListResponseDto,
} from "./dto/video-response.dto";
import { VideosService } from "./videos.service";

function VideoFilesUpload() {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor("files", 200, {
        limits: { fileSize: 5000 * 1024 * 1024 },
      }),
    ),
    ApiConsumes("multipart/form-data"),
    ApiBody({
      schema: {
        type: "object",
        properties: {
          files: {
            type: "array",
            items: { type: "string", format: "binary" },
          },
        },
      },
    }),
  );
}

@Controller("videos")
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    @Inject("S3_CLIENT") private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!;

  @Post("upload")
  @UseGuards(AdminGuard)
  @VideoFilesUpload()
  @ApiOkResponse({ type: UploadVideoResponseDto })
  async uploadVideoAdmin(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadVideoResponseDto> {
    const video = await this.videosService.uploadVideo(files);
    return new UploadVideoResponseDto(video);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: VideoListResponseDto })
  async listVideosAdmin(): Promise<VideoListResponseDto> {
    const videos = await this.videosService.listVideos();
    return new VideoListResponseDto(videos);
  }

  @Get(":id/details")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: VideoDetailResponseDto })
  async getVideoDetailsAdmin(
    @Param("id") id: number,
  ): Promise<VideoDetailResponseDto> {
    const result = await this.videosService.getVideoDetails(id);
    if (!result) throw new NotFoundException();
    return new VideoDetailResponseDto(result);
  }

  @Post(":id/replace")
  @UseGuards(AdminGuard)
  @VideoFilesUpload()
  @ApiOkResponse({ type: ReplaceVideoResponseDto })
  async replaceVideoAdmin(
    @Param("id") id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ReplaceVideoResponseDto> {
    const video = await this.videosService.replaceVideoContent(id, files);
    if (!video) throw new NotFoundException();
    return new ReplaceVideoResponseDto(video);
  }

  @Get(":id/:filename")
  @ApiOkResponse()
  async streamVideoFile(
    @Param("id") id: number,
    @Param("filename") filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const video = await this.videosService.getVideo(id);
    if (!video) throw new NotFoundException();

    await pipeS3Object({
      s3: this.s3,
      bucket: this.bucket,
      key: `${video.key}/${filename}`,
      res,
      contentType: filename.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : filename.endsWith(".ts")
          ? "video/MP2T"
          : undefined,
      // Replacing a video rewrites its files under the same names, and a
      // deleted video stops playing once this runs out.
      maxAgeSeconds: 60,
    });
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: DeleteVideoResponseDto })
  async deleteVideoAdmin(
    @Param("id") id: number,
  ): Promise<DeleteVideoResponseDto> {
    const video = await this.videosService.getVideo(id);
    if (!video) throw new NotFoundException();
    await this.videosService.deleteVideo(id);
    return new DeleteVideoResponseDto(true);
  }
}
