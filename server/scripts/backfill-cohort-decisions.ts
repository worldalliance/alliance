/**
 * Stage 3 of stable action assignments: saves cohort decisions for closed
 * actions launched before the resolver's first decision, from each cohort as
 * it evaluates now.
 *
 * Reports what it would do and exits; pass --apply to write. Re-running is
 * safe: an action with any decision is no longer the backfill's.
 *
 *   (cd server && bun scripts/backfill-cohort-decisions.ts)
 *   (cd server && bun scripts/backfill-cohort-decisions.ts --apply)
 */
import { NestFactory } from "@nestjs/core";
import { SchedulerRegistry } from "@nestjs/schedule";
import "reflect-metadata";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { AppModule } from "../src/app.module";

const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  // The running server owns the scheduled workers.
  for (const job of app.get(SchedulerRegistry).getCronJobs().values()) {
    void job.stop();
  }

  try {
    const cohortDecisionService = app.get(CohortDecisionService);

    const plan = await cohortDecisionService.planBackfill(new Date());
    for (const { action, rows } of plan) {
      const included = rows.filter((row) => row.included).length;
      console.log(
        `action ${action.id}: ${included} included, ${rows.length - included} excluded`,
      );
      if (apply) {
        await cohortDecisionService.insert(rows);
      }
    }

    console.log(
      apply
        ? `Backfilled ${plan.length} action(s).`
        : `Dry run over ${plan.length} action(s); pass --apply to write.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
