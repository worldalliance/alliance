import { KoraProjectStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import type { KoraAdminProject } from "./dto/kora-project.dto";
import { KORA_PROJECT_ID, KoraProject } from "./entities/kora-project.entity";

export enum KoraProjectError {
  NeedsTranscripts = "needs_transcripts",
}

@Injectable()
export class KoraProjectService {
  constructor(
    @InjectRepository(KoraProject)
    private readonly projectRepo: Repository<KoraProject>,
  ) {}

  project(): Promise<KoraProject> {
    return this.projectRepo.findOneByOrFail({ id: KORA_PROJECT_ID });
  }

  async adminProject(): Promise<KoraAdminProject> {
    return { project: await this.project(), canActivate: canActivate() };
  }

  async setStatus(
    status: KoraProjectStatus,
  ): Promise<Result<KoraAdminProject, KoraProjectError>> {
    if (status === KoraProjectStatus.Active && !canActivate()) {
      return R.failure(KoraProjectError.NeedsTranscripts);
    }
    await this.projectRepo.update({ id: KORA_PROJECT_ID }, { status });
    return R.success(await this.adminProject());
  }
}

// Active needs uploaded transcripts, and transcript upload doesn't exist yet.
function canActivate(): boolean {
  return false;
}
