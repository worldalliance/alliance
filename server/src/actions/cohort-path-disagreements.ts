import { R } from "@alliance/common/result";
import type { Logger } from "@nestjs/common";
import { chunk } from "es-toolkit";
import type { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import type { UserService } from "src/user/user.service";
import type { ActionsService } from "./actions.service";
import { formatIdSample } from "./cohort-decision";
import type { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import type { ParsedAction } from "./entities/action.entity";

const USER_LOAD_CHUNK_SIZE = 1000;

const SINGLE_MEMBER_CONCURRENCY = 20;

type Params = {
  action: ParsedAction;
  rows: Pick<ActionCohortDecision, "userId" | "included">[];
  session: CohortResolutionSession;
  userService: UserService;
  actionsService: ActionsService;
};

/**
 * Warns about decided members whom the single-member path
 * (`computeIsInCohortExpression`) places differently from their decision. A
 * failed comparison is logged as an error rather than thrown, so it never
 * holds back the decisions.
 */
export async function logCohortPathDisagreements(
  params: Params & { logger: Logger },
): Promise<void> {
  const { action, logger } = params;
  const result = await R.fromPromiseFn(() =>
    findCohortPathDisagreements(params),
  );
  if (R.isFailure(result)) {
    logger.error(
      `Failed to compare cohort paths for action ${action.id}`,
      result.error,
    );
    return;
  }
  const disagreements = result.value;
  if (disagreements.length === 0) return;
  logger.warn(
    `single-member cohort path disagrees with the backfill of action ${action.id} on member(s) ${formatIdSample(disagreements)}`,
  );
}

async function findCohortPathDisagreements(params: Params): Promise<number[]> {
  const { action, rows, session, userService, actionsService } = params;
  const users = new Map(
    (
      await Promise.all(
        chunk(
          rows.map((row) => row.userId),
          USER_LOAD_CHUNK_SIZE,
        ).map((ids) =>
          userService.findByIds(ids, {
            tags: true,
            contractEvents: true,
            awayRanges: true,
          }),
        ),
      )
    )
      .flat()
      .map((user) => [user.id, user]),
  );
  const disagreements: number[] = [];
  for (const batch of chunk(rows, SINGLE_MEMBER_CONCURRENCY)) {
    const singleMember = await Promise.all(
      batch.map((row) => {
        const user = users.get(row.userId);
        if (!user) {
          throw new Error(`user ${row.userId} was deleted mid-pass`);
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
  return disagreements;
}
