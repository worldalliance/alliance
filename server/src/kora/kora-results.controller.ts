import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiQuery } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  KoraAnswerCountsDto,
  KoraAssignmentExportDto,
  KoraExportsDto,
  KoraSpecExportDto,
} from "./dto/kora-results.dto";
import { countAnswers } from "./kora-answers";
import { KoraResultsService } from "./kora-results.service";
import { buildKoraSpecExport } from "./kora-spec-export";

enum KoraExportKind {
  Rolling = "rolling",
  Final = "final",
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

@Controller("kora/admin/results")
@UseGuards(AdminGuard)
export class KoraResultsController {
  constructor(private readonly resultsService: KoraResultsService) {}

  /** For the admin to download and send to KORA. */
  @Get("exports")
  @ApiOkResponse({ type: KoraExportsDto })
  async exports(): Promise<KoraExportsDto> {
    const stored = await this.resultsService.exports();
    return new KoraExportsDto({
      exports: stored.flatMap(({ exported, batches }) => {
        const record = asRecord(exported);
        return record ? [{ ...record, koraBatches: batches }] : [];
      }),
    });
  }

  /** KORA's own five-table export, built from every stored review. */
  @Get("kora-export")
  @ApiQuery({ name: "kind", enum: KoraExportKind, required: false })
  @ApiOkResponse({ type: KoraSpecExportDto })
  async koraExport(
    // A string, not the enum: Bun emits an enum parameter's design type, which the global ValidationPipe then rejects.
    @Query("kind") kindParam?: string,
  ): Promise<KoraSpecExportDto> {
    const kind = Object.values(KoraExportKind).find((k) => k === kindParam);
    if (kindParam !== undefined && !kind)
      throw new BadRequestException('kind must be "rolling" or "final"');
    return new KoraSpecExportDto(
      buildKoraSpecExport({
        ...(await this.resultsService.specExportInput()),
        generatedAt: new Date(),
        kind: kind ?? KoraExportKind.Rolling,
      }),
    );
  }

  @Get("answers")
  @ApiOkResponse({ type: KoraAnswerCountsDto })
  async answers(): Promise<KoraAnswerCountsDto> {
    return new KoraAnswerCountsDto(
      countAnswers(await this.resultsService.exports()),
    );
  }

  @Get("assignments/:id")
  @ApiOkResponse({ type: KoraAssignmentExportDto })
  async assignment(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<KoraAssignmentExportDto> {
    const assignment = await this.resultsService.assignment(id);
    if (!assignment) throw new NotFoundException("Assignment not found");
    return new KoraAssignmentExportDto({
      ...assignment,
      export: asRecord(assignment.export),
    });
  }
}
