import { S3Client } from "@aws-sdk/client-s3";
import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { Response } from "express";
import { pipeS3Object } from "src/s3/pipe-s3-object";
import { UploadImageDto, UploadImageResponseDto } from "./dto/image.dto";
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

  @Post("/uploadImage")
  @ApiOkResponse({ type: UploadImageResponseDto })
  async uploadImage(
    @Body() body: UploadImageDto,
  ): Promise<UploadImageResponseDto> {
    const key = await this.imagesService.uploadImage(body.file);
    return new UploadImageResponseDto({ url: getImageSource(key), key });
  }
}
