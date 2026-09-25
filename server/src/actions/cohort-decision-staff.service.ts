import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { ActionCohortDecisionCorrection } from "./entities/action-cohort-decision-correction.entity";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { CohortDecisionReason } from "./entities/cohort-decision-reason";

const DECISION_DETAIL_RELATIONS = {
  user: true,
  corrections: { correctedBy: true },
} as const;

const DECISION_DETAIL_ORDER = {
  userId: "ASC",
  corrections: { correctedAt: "ASC" },
} as const;

@Injectable()
export class CohortDecisionStaffService {
  constructor(
    @InjectRepository(ActionCohortDecision)
    private readonly decisionRepository: Repository<ActionCohortDecision>,
  ) {}

  hasDecisions(actionId: number): Promise<boolean> {
    return this.decisionRepository.exists({ where: { actionId } });
  }

  findForAction(actionId: number): Promise<ActionCohortDecision[]> {
    return this.decisionRepository.find({
      where: { actionId },
      relations: DECISION_DETAIL_RELATIONS,
      order: DECISION_DETAIL_ORDER,
    });
  }

  /**
   * Flip a member's saved decision, keeping the values it replaces alongside
   * the staff member's note.
   */
  async correct(params: {
    actionId: number;
    userId: number;
    included: boolean;
    note: string;
    staffUserId: number;
    now: Date;
  }): Promise<ActionCohortDecision> {
    const { actionId, userId, included, note, staffUserId, now } = params;
    await this.decisionRepository.manager.transaction(async (em) => {
      const decision = await em.findOne(ActionCohortDecision, {
        where: { actionId, userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!decision) {
        throw new NotFoundException(
          "This member has no cohort decision for this action yet.",
        );
      }
      if (decision.included === included) {
        throw new BadRequestException(
          `The decision already ${included ? "includes" : "excludes"} this member.`,
        );
      }
      await em.insert(ActionCohortDecisionCorrection, {
        decisionId: decision.id,
        previousIncluded: decision.included,
        previousReason: decision.reason,
        previousResolvedAt: decision.resolvedAt,
        note: note.trim(),
        correctedById: staffUserId,
      });
      await em.update(ActionCohortDecision, decision.id, {
        included,
        reason: CohortDecisionReason.StaffCorrection,
        resolvedAt: now,
      });
    });
    return this.decisionRepository.findOneOrFail({
      where: { actionId, userId },
      relations: DECISION_DETAIL_RELATIONS,
      order: DECISION_DETAIL_ORDER,
    });
  }
}
