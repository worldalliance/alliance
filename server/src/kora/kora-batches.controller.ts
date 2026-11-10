import { KORA_UPLOAD_NEEDS_BOTH_FILES } from "@alliance/common/kora";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
} from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  KoraBatchDto,
  KoraTranscriptPreviewDto,
  KoraUploadRejectedDto,
  UploadKoraBatchDto,
} from "./dto/kora-batch.dto";
import { KoraBatchService, KoraUploadError } from "./kora-batch.service";

const TRANSCRIPTS_MAX_BYTES = 50 * 1024 * 1024;

type UploadedBatchFiles = {
  transcripts?: Express.Multer.File[];
  exportSchema?: Express.Multer.File[];
};

@Controller("kora/admin/batches")
@UseGuards(AdminGuard)
export class KoraBatchesController {
  constructor(private readonly batchService: KoraBatchService) {}

  @Get()
  @ApiOkResponse({ type: KoraBatchDto, isArray: true })
  async list(): Promise<KoraBatchDto[]> {
    return (await this.batchService.list()).map((b) => new KoraBatchDto(b));
  }

  /** All or nothing: any invalid line rejects the file, listing every bad line. */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "transcripts", maxCount: 1 },
        { name: "exportSchema", maxCount: 1 },
      ],
      { limits: { fileSize: TRANSCRIPTS_MAX_BYTES } },
    ),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "transcripts",
        "exportSchema",
        "transcriptsPerAssignment",
        "reviewsPerTranscript",
      ],
      properties: {
        transcripts: { type: "string", format: "binary" },
        exportSchema: { type: "string", format: "binary" },
        transcriptsPerAssignment: { type: "integer" },
        reviewsPerTranscript: { type: "integer" },
      },
    },
  })
  @ApiOkResponse({ type: KoraBatchDto })
  @ApiBadRequestResponse({ type: KoraUploadRejectedDto })
  async upload(
    @Body() dto: UploadKoraBatchDto,
    @UploadedFiles() files: UploadedBatchFiles,
  ): Promise<KoraBatchDto> {
    const transcripts = files.transcripts?.[0];
    const exportSchema = files.exportSchema?.[0];
    if (!transcripts || !exportSchema) {
      throw new BadRequestException(KORA_UPLOAD_NEEDS_BOTH_FILES);
    }
    const uploaded = await this.batchService.upload({
      transcriptsText: transcripts.buffer.toString("utf8"),
      exportSchemaText: exportSchema.buffer.toString("utf8"),
      transcriptsPerAssignment: dto.transcriptsPerAssignment,
      reviewsPerTranscript: dto.reviewsPerTranscript,
    });
    if (!uploaded.ok) {
      const refusal = uploaded.error;
      switch (refusal.error) {
        case KoraUploadError.ExportSchema:
          throw new BadRequestException(refusal.message);
        case KoraUploadError.Lines:
          throw new BadRequestException({
            message: `${refusal.rejected.length === 1 ? "1 line was" : `${refusal.rejected.length} lines were`} rejected, so nothing was uploaded.`,
            rejected: refusal.rejected,
          } satisfies KoraUploadRejectedDto);
        default:
          throw new Error(`unknown refusal: ${refusal satisfies never}`);
      }
    }
    return new KoraBatchDto(uploaded.value);
  }

  @Get(":id/random-transcript")
  @ApiOkResponse({ type: KoraTranscriptPreviewDto })
  async randomTranscript(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<KoraTranscriptPreviewDto> {
    const transcript = await this.batchService.randomTranscript(id);
    if (!transcript) {
      throw new NotFoundException("Batch not found");
    }
    return new KoraTranscriptPreviewDto(transcript);
  }
}
