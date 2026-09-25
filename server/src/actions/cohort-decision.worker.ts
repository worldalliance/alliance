import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { withPgAdvisoryLock } from "src/notifs/lock-utils";
import { DataSource } from "typeorm";
import { CohortDecisionService } from "./cohort-decision.service";

const [LOCK_KEY1, LOCK_KEY2] = LOCK_KEYS.cohortDecision;

@Injectable()
export class CohortDecisionWorker {
  private readonly logger = new Logger(CohortDecisionWorker.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cohortDecisionService: CohortDecisionService,
  ) {}

  @Cron("*/5 * * * *")
  async resolveDecisions() {
    const ran = await withPgAdvisoryLock(
      this.dataSource,
      LOCK_KEY1,
      LOCK_KEY2,
      () => this.cohortDecisionService.resolveAll(new Date()),
    );
    if (ran === null) {
      this.logger.log("cohort decision pass skipped bc of lock");
    }
  }
}
