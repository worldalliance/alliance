import {
  IMAGE_CACHE_CONTROL,
  isUploadKey,
  jpegFileName,
} from "@alliance/common/image-src";
import { S3Client } from "@aws-sdk/client-s3";
import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiQuery } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { create as contentDisposition } from "content-disposition";
import type { Request, Response } from "express";
import { pipeS3Object } from "src/s3/pipe-s3-object";
import { OnlyThrottle } from "src/utils/throttle";
import { UploadImageDto, UploadImageResponseDto } from "./dto/image.dto";
import { IMAGE_DOWNLOAD_THROTTLE } from "./image-download-throttle.config";
import { getImageSource, ImagesService } from "./images.service";

@Controller("images")
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    @Inject("S3_CLIENT") private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!;

  @Get(":key")
  @ApiOkResponse({ type: StreamableFile })
  async getImage(
    @Param("key") key: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!key) throw new NotFoundException();

    await pipeS3Object({ s3: this.s3, bucket: this.bucket, key, res });
  }

  @Get(":key/download")
  @UseGuards(ThrottlerGuard)
  @OnlyThrottle(IMAGE_DOWNLOAD_THROTTLE)
  @ApiOkResponse({ type: StreamableFile })
  @ApiQuery({ name: "name", required: false, type: String })
  async downloadImage(
    @Param("key") key: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query("name") name?: unknown,
  ): Promise<void> {
    if (!isUploadKey(key)) throw new NotFoundException();
    const jpeg = await this.imagesService.jpegDownload({
      key,
      requester: String(req.ip),
      clientGone: () => req.socket.destroyed,
    });
    if (!jpeg) return;
    // Express's attachment() sends Latin-1 names raw, and Bun drops the header.
    res
      .set({
        "Content-Disposition": contentDisposition(
          jpegFileName(typeof name === "string" ? name : undefined),
        ),
        "Content-Type": "image/jpeg",
        "Cache-Control": IMAGE_CACHE_CONTROL,
      })
      .send(jpeg);
  }

  @Post("/uploadImage")
  @ApiOkResponse({ type: UploadImageResponseDto })
  async uploadImage(
    @Body() body: UploadImageDto,
  ): Promise<UploadImageResponseDto> {
    const key = await this.imagesService.uploadImage(body.file);
    return new UploadImageResponseDto({ url: getImageSource(key), key });
  }
}
