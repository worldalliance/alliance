import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type EntityManager, type Repository } from "typeorm";
import { ActionCohortDecisionCorrection } from "./entities/action-cohort-decision-correction.entity";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { Action } from "./entities/action.entity";
import { CohortDecisionReason } from "./entities/cohort-decision-reason";
import { shortensMemberActionDeadline } from "./utils/action-event";

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

  /**
   * Runs a schedule change in a transaction and rolls it back if it brings
   * forward the deadline of an action with assigned members, unless staff
   * acknowledged that. The earlier deadline applies to those members.
   */
  async guardDeadlineShortening<T>(params: {
    actionIds: number[];
    acknowledged: boolean;
    change: (em: EntityManager) => Promise<T>;
  }): Promise<T> {
    const { actionIds, acknowledged, change } = params;
    return this.decisionRepository.manager.transaction(async (em) => {
      if (acknowledged) return change(em);
      const before = await this.findActionsWithEvents(em, actionIds);
      const result = await change(em);
      const after = await this.findActionsWithEvents(em, actionIds);
      const shortened = after.filter((action) => {
        const previous = before.find(({ id }) => id === action.id);
        return (
          previous &&
          shortensMemberActionDeadline(
            previous.memberActionPhase,
            action.memberActionPhase,
          )
        );
      });
      if (shortened.length === 0) return result;
      const assigned = await em
        .createQueryBuilder(ActionCohortDecision, "decision")
        .select('decision."actionId"', "actionId")
        .addSelect("COUNT(*)::int", "count")
        .where('decision."actionId" IN (:...actionIds)', {
          actionIds: shortened.map(({ id }) => id),
        })
        .andWhere("decision.included")
        .groupBy('decision."actionId"')
        .getRawMany<{ actionId: number; count: number }>();
      if (assigned.length === 0) return result;
      const affected = assigned.map(({ actionId, count }) => {
        const name = shortened.find(({ id }) => id === actionId)?.name;
        return `"${name}" (${count} assigned)`;
      });
      throw new ConflictException(
        `This moves the deadline earlier for members already assigned to ${affected.join(", ")}. They keep their assignment and get the earlier deadline.`,
      );
    });
  }

  private findActionsWithEvents(
    em: EntityManager,
    actionIds: number[],
  ): Promise<Action[]> {
    return em.find(Action, {
      where: { id: In(actionIds) },
      relations: { events: true },
    });
  }
}
