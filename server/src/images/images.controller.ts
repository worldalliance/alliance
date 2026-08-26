import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
import { basename } from "path";
import { Readable } from "stream";
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

    const ac = new AbortController();

    res.on("close", () => ac.abort());
    res.on("error", () => ac.abort());

    try {
      const out = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: ac.signal },
      );

      const body = out.Body as Readable | undefined;
      if (!body) throw new NotFoundException();

      res.setHeader(
        "Content-Type",
        out.ContentType ?? "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${basename(key)}"`,
      );
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      body.on("error", () => {
        try {
          body.destroy();
        } catch {}
        if (!res.headersSent) res.status(500);
        res.end();
      });

      body.pipe(res);
    } catch (err) {
      if (err?.name === "AbortError") return;

      if (process.env.NODE_ENV !== "development") {
        console.error("Error getting image:", err);
      }
      throw new NotFoundException();
    }
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
