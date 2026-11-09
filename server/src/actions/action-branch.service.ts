import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import { routedCohortExpression, sortBranches } from "./action-branches";
import type { CohortResolutionSession } from "./cohort-resolution-session";
import {
  ActionBranch,
  parseActionBranch,
  type ParsedActionBranch,
} from "./entities/action-branch.entity";
import type { ParsedAction } from "./entities/action.entity";

@Injectable()
export class ActionBranchService {
  constructor(
    @InjectRepository(ActionBranch)
    private readonly branchRepository: Repository<ActionBranch>,
  ) {}

  loadBranches(
    actionId: number,
    session: CohortResolutionSession,
  ): Promise<ParsedActionBranch[]> {
    let pending = session.branchesByActionId.get(actionId);
    if (!pending) {
      pending = this.findBranches([actionId]).then(
        (byAction) => byAction.get(actionId) ?? [],
      );
      session.branchesByActionId.set(actionId, pending);
    }
    return pending;
  }

  async findBranches(
    actionIds: number[],
  ): Promise<Map<number, ParsedActionBranch[]>> {
    if (actionIds.length === 0) return new Map();
    const branches = await this.branchRepository.find({
      where: { actionId: In(actionIds) },
    });
    const byAction = Map.groupBy(
      branches.map(parseActionBranch),
      (branch) => branch.actionId,
    );
    for (const list of byAction.values()) sortBranches(list);
    return byAction;
  }

  async attachBranches(actions: ParsedAction[]): Promise<void> {
    const missing = actions.filter((action) => !action.branches);
    const byAction = await this.findBranches(missing.map((a) => a.id));
    for (const action of missing) {
      action.branches = byAction.get(action.id) ?? [];
    }
  }

  async loadRoutedCohortExpression(
    action: Pick<ParsedAction, "id" | "cohortExpression">,
    session: CohortResolutionSession,
  ): Promise<CohortExpression | null> {
    return routedCohortExpression(
      action.cohortExpression,
      await this.loadBranches(action.id, session),
    );
  }
}
