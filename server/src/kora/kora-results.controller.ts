import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { KoraAnswerCountsDto, KoraExportsDto } from "./dto/kora-results.dto";
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
      exports: stored.flatMap(({ exported }) => {
        const record = asRecord(exported);
        return record ? [record] : [];
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
}
