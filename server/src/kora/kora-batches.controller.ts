import { KORA_UPLOAD_NEEDS_CONVERSATIONS } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
} from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import {
  KoraBatchDto,
  KoraBatchEventDto,
  KoraDeletionImpactDto,
  KoraUploadRejectedDto,
  SetKoraBatchClosesAtDto,
  UploadKoraBatchDto,
} from "./dto/kora-batch.dto";
import { KoraItemDto } from "./dto/kora-review.dto";
import {
  KoraBatchActionError,
  KoraBatchActionsService,
} from "./kora-batch-actions.service";
import { KoraBatchService } from "./kora-batch.service";
import { koraItem } from "./kora-item";
import { koraStagingTools } from "./kora-staging-tools";

const TRANSCRIPTS_MAX_BYTES = 50 * 1024 * 1024;

@Controller("kora/admin/batches")
@UseGuards(AdminGuard)
export class KoraBatchesController {
  constructor(
    private readonly batchService: KoraBatchService,
    private readonly actions: KoraBatchActionsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: KoraBatchDto, isArray: true })
  async list(): Promise<KoraBatchDto[]> {
    return (await this.batchService.list()).map((b) => new KoraBatchDto(b));
  }

  /** All or nothing: any invalid line rejects the file, listing every bad line. */
  @Post()
  @UseInterceptors(
    FileInterceptor("conversations", {
      limits: { fileSize: TRANSCRIPTS_MAX_BYTES },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["conversations", "reviewsPerConversation", "closesAt"],
      properties: {
        conversations: { type: "string", format: "binary" },
        reviewsPerConversation: { type: "integer" },
        closesAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiOkResponse({ type: KoraBatchDto })
  @ApiBadRequestResponse({ type: KoraUploadRejectedDto })
  async upload(
    @Body() dto: UploadKoraBatchDto,
    @UploadedFile() conversations: Express.Multer.File | undefined,
    @Request() req: JwtRequest,
  ): Promise<KoraBatchDto> {
    if (!conversations) {
      throw new BadRequestException(KORA_UPLOAD_NEEDS_CONVERSATIONS);
    }
    const uploaded = await this.batchService.upload({
      conversationsText: conversations.buffer.toString("utf8"),
      reviewsPerConversation: dto.reviewsPerConversation,
      closesAt: dto.closesAt,
      actor: await this.actions.actor(req.user.sub),
    });
    if (!uploaded.ok) {
      const rejected = uploaded.error;
      throw new BadRequestException({
        message: `${rejected.length === 1 ? "1 line was" : `${rejected.length} lines were`} rejected, so nothing was uploaded.`,
        rejected,
      } satisfies KoraUploadRejectedDto);
    }
    return new KoraBatchDto(uploaded.value);
  }

  /** One conversation from the batch as a reviewer would be served it, for the admin preview. */
  @Get(":id/random-conversation")
  @ApiOkResponse({ type: KoraItemDto })
  async randomConversation(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<KoraItemDto> {
    const conversation = await this.batchService.randomConversation(id);
    if (!conversation) {
      throw new NotFoundException("Batch not found");
    }
    return new KoraItemDto(
      koraItem({ conversation, ratedPosition: null, firstTimeOnRisk: true }),
    );
  }

  @Get("events")
  @ApiOkResponse({ type: KoraBatchEventDto, isArray: true })
  async events(): Promise<KoraBatchEventDto[]> {
    return (await this.actions.list()).map((e) => new KoraBatchEventDto(e));
  }

  @Post(":id/retire")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KoraBatchDto })
  async retire(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: JwtRequest,
  ): Promise<KoraBatchDto> {
    const retired = await this.actions.retire({
      batchId: id,
      actor: await this.actions.actor(req.user.sub),
    });
    return new KoraBatchDto(found(retired));
  }

  @Post(":id/reactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: KoraBatchDto })
  async reactivate(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: JwtRequest,
  ): Promise<KoraBatchDto> {
    const reactivated = await this.actions.reactivate({
      batchId: id,
      actor: await this.actions.actor(req.user.sub),
    });
    return new KoraBatchDto(found(reactivated));
  }

  /** Also moves the closing date of unfinished assignments holding its transcripts. */
  @Put(":id/closes-at")
  @ApiOkResponse({ type: KoraBatchDto })
  async setClosesAt(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetKoraBatchClosesAtDto,
  ): Promise<KoraBatchDto> {
    return new KoraBatchDto(
      found(
        await this.batchService.setClosesAt({
          batchId: id,
          closesAt: dto.closesAt,
        }),
      ),
    );
  }

  @Get(":id/deletion-impact")
  @ApiOkResponse({ type: KoraDeletionImpactDto })
  async deletionImpact(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<KoraDeletionImpactDto> {
    requireStagingTools();
    return new KoraDeletionImpactDto(
      found(await this.actions.deletionImpact(id)),
    );
  }

  /** Staging and local development only; 404 in production. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: JwtRequest,
  ): Promise<void> {
    requireStagingTools();
    found(
      await this.actions.delete({
        batchId: id,
        actor: await this.actions.actor(req.user.sub),
      }),
    );
  }
}

function requireStagingTools(): void {
  if (!koraStagingTools()) throw new NotFoundException();
}

function found<T>(result: Result<T, KoraBatchActionError>): T {
  return R.match(result, {
    success: (value) => value,
    failure: (error) => {
      switch (error) {
        case KoraBatchActionError.NotFound:
          throw new NotFoundException("Batch not found");
        default:
          throw new Error(`unknown error: ${error satisfies never}`);
      }
    },
  });
}
