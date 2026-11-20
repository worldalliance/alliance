import { Injectable } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron } from "@nestjs/schedule";
import { CronLease } from "src/leases/cron-lease";
import { CohortDecisionService } from "./cohort-decision.service";
import { CohortDivergenceService } from "./cohort-divergence.service";

@Injectable()
export class CohortDecisionWorker {
  constructor(
    private readonly cohortDecisionService: CohortDecisionService,
    private readonly cohortDivergenceService: CohortDivergenceService,
  ) {}

  @Cron("*/5 * * * *")
  @WithoutOverlapping({ key: CronLease.CohortDecisions })
  async resolveDecisions() {
    await this.cohortDecisionService.resolveAll(new Date());
  }

  /** Unleased: it only reads and logs, so a second run duplicates log lines. */
  @Cron("2 * * * *")
  async logDivergences() {
    const now = new Date();
    const failures = (
      await Promise.allSettled([
        this.cohortDivergenceService.logDivergences(now),
        this.cohortDivergenceService.logUnawaitedOpenReferences(now),
      ])
    ).flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "cohort decision divergence checks failed",
      );
    }
  }
}
