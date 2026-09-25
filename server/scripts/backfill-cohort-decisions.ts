/**
 * Stage 3 of stable action assignments: saves cohort decisions for closed
 * actions launched before the resolver's first decision, from each cohort as
 * it evaluates now. Reports, per action, members the single-member cohort path
 * (`ActionsService.computeIsInCohortExpression`) places differently from the
 * roster path the decisions use.
 *
 * Reports what it would do and exits; pass --apply to write. Re-running is
 * safe: an action with any decision is no longer the backfill's.
 *
 *   (cd server && bun scripts/backfill-cohort-decisions.ts)
 *   (cd server && bun scripts/backfill-cohort-decisions.ts --apply)
 */
import { NestFactory } from "@nestjs/core";
import { SchedulerRegistry } from "@nestjs/schedule";
import { chunk } from "es-toolkit";
import "reflect-metadata";
import { ActionsService } from "../src/actions/actions.service";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { AppModule } from "../src/app.module";
import { CohortResolutionSession } from "../src/notifs/cohort-resolution-session";
import { UserService } from "../src/user/user.service";

const SAMPLE_SIZE = 20;
const CONCURRENCY = 20;

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
    const actionsService = app.get(ActionsService);
    const userService = app.get(UserService);

    const plan = await cohortDecisionService.planBackfill(new Date());
    const users = new Map(
      (
        await userService.findByIds(
          [...new Set(plan.flatMap(({ rows }) => rows.map((r) => r.userId)))],
          { tags: true, contractEvents: true, awayRanges: true },
        )
      ).map((user) => [user.id, user]),
    );

    const session = new CohortResolutionSession();
    for (const { action, rows } of plan) {
      const disagreements: number[] = [];
      for (const batch of chunk(rows, CONCURRENCY)) {
        const singleMember = await Promise.all(
          batch.map((row) => {
            const user = users.get(row.userId);
            if (!user) {
              throw new Error(`user ${row.userId} was deleted mid-run`);
            }
            return actionsService.computeIsInCohortExpression({
              user,
              cohortExpression: action.cohortExpression,
              session,
            });
          }),
        );
        batch.forEach((row, i) => {
          if (singleMember[i] !== row.included) disagreements.push(row.userId);
        });
      }
      const included = rows.filter((row) => row.included).length;
      console.log(
        `action ${action.id}: ${included} included, ${rows.length - included} excluded` +
          (disagreements.length
            ? `; single-member path disagrees on ${disagreements.length} [${disagreements.slice(0, SAMPLE_SIZE).join(", ")}]`
            : ""),
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
