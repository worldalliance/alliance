import { HOSTED_DOC_MAX_BYTES } from "@alliance/common/hostedDocs";
import { S3Client } from "@aws-sdk/client-s3";
import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOkResponse } from "@nestjs/swagger";
import type { Request as ExpressRequest, Response } from "express";
import { basename } from "path";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { AuthOptionalGuard } from "src/auth/guards/authoptional.guard";
import { Public } from "src/auth/public.decorator";
import type { JwtRequest } from "src/auth/tokens";
import { pipeS3Object } from "src/s3/pipe-s3-object";
import {
  CreateHostedDocDto,
  HostedDocDto,
  UpdateHostedDocDto,
} from "./dto/hosted-doc.dto";
import { HostedDocsService } from "./hosted-docs.service";

const MAX_AGE_SECONDS = 300;

function PdfUpload(fields: Record<string, { type: "string" }> = {}) {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor("file", { limits: { fileSize: HOSTED_DOC_MAX_BYTES } }),
    ),
    ApiConsumes("multipart/form-data"),
    ApiBody({
      schema: {
        type: "object",
        required: ["file", ...Object.keys(fields)],
        properties: { file: { type: "string", format: "binary" }, ...fields },
      },
    }),
  );
}

@Controller("hosted-docs")
@UseGuards(AdminGuard)
export class HostedDocsController {
  constructor(private readonly hostedDocsService: HostedDocsService) {}

  @Get()
  @ApiOkResponse({ type: HostedDocDto, isArray: true })
  async findAllAdmin(): Promise<HostedDocDto[]> {
    return (await this.hostedDocsService.findAll()).map(
      (doc) => new HostedDocDto(doc),
    );
  }

  @Post()
  @PdfUpload({ slug: { type: "string" }, notes: { type: "string" } })
  @ApiOkResponse({ type: HostedDocDto })
  async createAdmin(
    @Request() req: JwtRequest,
    @Body() dto: CreateHostedDocDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<HostedDocDto> {
    return new HostedDocDto(
      await this.hostedDocsService.create({
        dto,
        file,
        adminId: req.user.sub,
      }),
    );
  }

  @Post(":id/file")
  @PdfUpload()
  @ApiOkResponse({ type: HostedDocDto })
  async replaceFileAdmin(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<HostedDocDto> {
    return new HostedDocDto(
      await this.hostedDocsService.replaceFile({
        id,
        file,
        adminId: req.user.sub,
      }),
    );
  }

  @Patch(":id")
  @ApiOkResponse({ type: HostedDocDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateHostedDocDto,
  ): Promise<HostedDocDto> {
    return new HostedDocDto(await this.hostedDocsService.update(id, dto));
  }

  @Delete(":id")
  @ApiOkResponse()
  async removeAdmin(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.hostedDocsService.remove(id);
  }
}

@Controller("docs")
export class DocsController {
  constructor(
    private readonly hostedDocsService: HostedDocsService,
    @Inject("S3_CLIENT") private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!;

  @Get(":slug")
  @Public()
  @UseGuards(AuthOptionalGuard)
  @ApiOkResponse()
  async serve(
    @Param("slug") slug: string,
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.hostedDocsService.findBySlug(slug);
    if (doc.slug !== slug) {
      res.redirect(HttpStatus.MOVED_PERMANENTLY, `/docs/${doc.slug}`);
      return;
    }

    const range = req.headers.range;
    if (!range || range.startsWith("bytes=0-"))
      this.hostedDocsService.countView(doc.id);

    // Each upload gets a fresh key, so the key identifies the file's contents.
    res.setHeader("ETag", `"${basename(doc.s3Key, ".pdf")}"`);
    res.setHeader("Cache-Control", `public, max-age=${MAX_AGE_SECONDS}`);
    if (req.fresh) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    await pipeS3Object({
      s3: this.s3,
      bucket: this.bucket,
      key: doc.s3Key,
      res,
      contentType: "application/pdf",
      maxAgeSeconds: MAX_AGE_SECONDS,
      range,
      filename: doc.slug,
    });
  }
}
