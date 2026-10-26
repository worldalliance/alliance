import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Not, type Repository } from "typeorm";
import {
  type ActionBranch,
  isActionBranch,
  routedCohortExpression,
  sortBranches,
} from "./action-branches";
import type { CohortResolutionSession } from "./cohort-resolution-session";
import {
  ActionFormVariant,
  parseActionFormVariant,
} from "./entities/action-form-variant.entity";
import type { ParsedAction } from "./entities/action.entity";

@Injectable()
export class ActionBranchService {
  constructor(
    @InjectRepository(ActionFormVariant)
    private readonly variantRepository: Repository<ActionFormVariant>,
  ) {}

  /** The action's rule branches in routing order; empty unless it routes by rule. */
  loadBranches(
    actionId: number,
    session: CohortResolutionSession,
  ): Promise<ActionBranch[]> {
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
  ): Promise<Map<number, ActionBranch[]>> {
    if (actionIds.length === 0) return new Map();
    const variants = await this.variantRepository.find({
      where: { actionId: In(actionIds), rule: Not(IsNull()) },
    });
    const byAction = new Map<number, ActionBranch[]>();
    for (const variant of variants.map(parseActionFormVariant)) {
      if (!isActionBranch(variant)) continue;
      byAction.set(variant.actionId, [
        ...(byAction.get(variant.actionId) ?? []),
        variant,
      ]);
    }
    for (const branches of byAction.values()) sortBranches(branches);
    return byAction;
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
