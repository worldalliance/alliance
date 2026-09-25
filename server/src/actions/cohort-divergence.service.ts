import { collectCohortDependencies } from "@alliance/common/cohort-expression";
import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { groupBy } from "es-toolkit";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { UserService } from "src/user/user.service";
import { In, Not, type Repository } from "typeorm";
import { formatIdSample } from "./cohort-decision";
import { CohortDecisionService } from "./cohort-decision.service";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { CohortDecisionReason } from "./entities/cohort-decision-reason";

@Injectable()
export class CohortDivergenceService {
  private readonly logger = new Logger(CohortDivergenceService.name);

  constructor(
    @InjectRepository(ActionCohortDecision)
    private readonly decisionRepository: Repository<ActionCohortDecision>,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly userService: UserService,
    private readonly cohortDecisionService: CohortDecisionService,
  ) {}

  /**
   * Shadow check: log where saved decisions disagree with the live cohort. An
   * expression without action or form references diverges only through
   * changes to members' profiles, tags, or group leadership, or staff edits
   * to the expression; the rest can also diverge as upstream actions
   * progress. A failing action is logged and skipped.
   */
  async logDivergences(now: Date): Promise<void> {
    const actions = await this.cohortDecisionService.findActionsInCatchUp(now);
    const rows = await this.decisionRepository.find({
      where: {
        actionId: In(actions.map(({ action }) => action.id)),
        reason: Not(
          In([
            CohortDecisionReason.ResolvedAfterDeadline,
            CohortDecisionReason.StaffCorrection,
          ]),
        ),
      },
      select: { actionId: true, userId: true, included: true },
    });
    if (rows.length === 0) return;
    const rowsByAction = groupBy(rows, (row) => row.actionId);
    const session = new CohortResolutionSession();
    await this.actionEventRecipientService.primeActiveUsers(session, () =>
      this.userService.findActiveUsersForRoster(),
    );
    for (const { action } of actions) {
      const decisions = rowsByAction[action.id];
      if (!decisions) continue;
      const result = await R.fromPromiseFn(() =>
        this.actionEventRecipientService.resolveCohortMemberIds(
          action.cohortExpression,
          session,
        ),
      );
      if (R.isFailure(result)) {
        this.logger.error(
          `Failed to check cohort divergence for action ${action.id}`,
          result.error,
        );
        continue;
      }
      const live = result.value;
      const nowIn = decisions
        .filter((row) => !row.included && live.has(row.userId))
        .map((row) => row.userId);
      const nowOut = decisions
        .filter((row) => row.included && !live.has(row.userId))
        .map((row) => row.userId);
      if (nowIn.length === 0 && nowOut.length === 0) continue;
      const { actionIds, formIds } = collectCohortDependencies(
        action.cohortExpression,
      );
      const bucket =
        actionIds.size + formIds.size > 0
          ? "activity-dependent expression"
          : "profile-only expression";
      this.logger.warn(
        `cohort decisions for action ${action.id} diverge from the live cohort (${bucket}): now in ${formatIdSample(nowIn)}, now out ${formatIdSample(nowOut)}`,
      );
    }
  }
}
