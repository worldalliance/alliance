import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  KoraAnswerCountsDto,
  KoraExportsDto,
  KoraSessionExportDto,
} from "./dto/kora-results.dto";
import { countAnswers } from "./kora-answers";
import { KoraResultsService } from "./kora-results.service";

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

  @Get("answers")
  @ApiOkResponse({ type: KoraAnswerCountsDto })
  async answers(): Promise<KoraAnswerCountsDto> {
    return new KoraAnswerCountsDto(
      countAnswers(await this.resultsService.exports()),
    );
  }

  @Get("sessions/:id")
  @ApiOkResponse({ type: KoraSessionExportDto })
  async session(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<KoraSessionExportDto> {
    const session = await this.resultsService.session(id);
    if (!session) throw new NotFoundException("Session not found");
    return new KoraSessionExportDto({
      ...session,
      export: asRecord(session.export),
    });
  }
}
