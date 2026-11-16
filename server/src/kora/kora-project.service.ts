import { KoraProjectStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import type { KoraAdminProject } from "./dto/kora-project.dto";
import { KORA_PROJECT_ID, KoraProject } from "./entities/kora-project.entity";
import { KoraBatchService } from "./kora-batch.service";

export type KoraProjectState = Omit<
  KoraAdminProject,
  "toNotify" | "moreToNotify"
>;

export enum KoraProjectError {
  NeedsTranscripts = "needs_transcripts",
}

@Injectable()
export class KoraProjectService {
  constructor(
    @InjectRepository(KoraProject)
    private readonly projectRepo: Repository<KoraProject>,
    private readonly batchService: KoraBatchService,
  ) {}

  project(): Promise<KoraProject> {
    return this.projectRepo.findOneByOrFail({ id: KORA_PROJECT_ID });
  }

  async adminProject(): Promise<KoraProjectState> {
    const [project, canActivate] = await Promise.all([
      this.project(),
      this.batchService.hasTranscripts(),
    ]);
    return { project, canActivate };
  }

  async setStatus(
    status: KoraProjectStatus,
  ): Promise<Result<KoraProjectState, KoraProjectError>> {
    if (
      status === KoraProjectStatus.Active &&
      !(await this.batchService.hasTranscripts())
    ) {
      return R.failure(KoraProjectError.NeedsTranscripts);
    }
    await this.projectRepo.update({ id: KORA_PROJECT_ID }, { status });
    return R.success(await this.adminProject());
  }
}
