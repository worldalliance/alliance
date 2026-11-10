import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { In, type EntityManager, type Repository } from "typeorm";
import { computeCohortEnrollment, isInCatchUp } from "./cohort-decision";
import { ActionCohortDecisionCorrection } from "./entities/action-cohort-decision-correction.entity";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import type { ParsedSplit } from "./entities/action-suite-split.entity";
import { Action } from "./entities/action.entity";
import { CohortDecisionReason } from "./entities/cohort-decision-reason";
import { PrerequisiteProgressService } from "./prerequisite-progress.service";
import { SuiteSplitsService } from "./suite-splits.service";
import { shortensMemberActionDeadline } from "./utils/action-event";

export type ArmMovePreview = {
  currentArmActionId: number | null;
  hasCompletion: boolean;
  hasSubmittedResponse: boolean;
};

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
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    private readonly suiteSplits: SuiteSplitsService,
    private readonly prerequisiteProgress: PrerequisiteProgressService,
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
    if (await this.suiteSplits.findForAction(actionId)) {
      throw new BadRequestException(
        "This action is an arm of a split. Move the member to another arm or remove them from the split instead.",
      );
    }
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
      await applyCorrection(em, {
        decision,
        included,
        note,
        staffUserId,
        now,
      });
    });
    return this.decisionRepository.findOneOrFail({
      where: { actionId, userId },
      relations: DECISION_DETAIL_RELATIONS,
      order: DECISION_DETAIL_ORDER,
    });
  }

  /** What the move dialog warns about for the member's current arm. */
  async findArmMovePreview(params: {
    actionId: number;
    userId: number;
  }): Promise<ArmMovePreview> {
    const { actionId, userId } = params;
    const split = await this.findSplitOrThrow(actionId);
    const current = await this.decisionRepository.findOne({
      where: {
        userId,
        included: true,
        actionId: In(split.arms.map((arm) => arm.actionId)),
      },
      relations: { action: true },
    });
    if (!current?.action) {
      return {
        currentArmActionId: null,
        hasCompletion: false,
        hasSubmittedResponse: false,
      };
    }
    const { taskFormId } = current.action;
    const [completions, responses] = await Promise.all([
      this.prerequisiteProgress.loadCompletions({
        actionId: current.actionId,
        userId,
      }),
      taskFormId === null
        ? 0
        : this.formResponseRepository.count({
            where: { formId: taskFormId, user: { id: userId } },
          }),
    ]);
    return {
      currentArmActionId: current.actionId,
      hasCompletion: completions.length > 0,
      hasSubmittedResponse: responses > 0,
    };
  }

  /**
   * Includes the member in the arm and excludes them from its siblings, as
   * one correction with one note. Their completion and responses on the arm
   * they leave stay there.
   */
  async moveToArm(params: {
    actionId: number;
    userId: number;
    note: string;
    staffUserId: number;
    now: Date;
  }): Promise<void> {
    const { actionId, userId, now } = params;
    const split = await this.findSplitOrThrow(actionId);
    const arms = await this.loadOpenArms(split, now);
    const target = arms.find((arm) => arm.id === actionId);
    const completed = new Set(
      (await this.prerequisiteProgress.loadCompletions({ userId })).map(
        (completion) => completion.actionId,
      ),
    );
    if (target?.prerequisiteActionIds.some((id) => !completed.has(id))) {
      throw new BadRequestException(
        `This member hasn't completed the prerequisites of "${target.name}".`,
      );
    }
    await this.rewriteSplitDecisions({
      ...params,
      split,
      includedId: actionId,
    });
  }

  async removeFromSplit(params: {
    actionId: number;
    userId: number;
    note: string;
    staffUserId: number;
    now: Date;
  }): Promise<void> {
    const split = await this.findSplitOrThrow(params.actionId);
    await this.loadOpenArms(split, params.now);
    await this.rewriteSplitDecisions({ ...params, split, includedId: null });
  }

  private async findSplitOrThrow(actionId: number): Promise<ParsedSplit> {
    const split = await this.suiteSplits.findForAction(actionId);
    if (!split) {
      throw new BadRequestException("This action isn't an arm of a split.");
    }
    return split;
  }

  private async loadOpenArms(split: ParsedSplit, now: Date): Promise<Action[]> {
    const arms = await this.actionRepository.find({
      where: { id: In(split.arms.map((arm) => arm.actionId)) },
      relations: { events: true },
    });
    if (
      !arms.every((arm) => isInCatchUp(computeCohortEnrollment(arm, now), now))
    ) {
      throw new BadRequestException(
        "Members can change arms only while the split is open or in its week of catch-up after the deadline.",
      );
    }
    return arms;
  }

  private async rewriteSplitDecisions(params: {
    split: ParsedSplit;
    userId: number;
    includedId: number | null;
    note: string;
    staffUserId: number;
    now: Date;
  }): Promise<void> {
    const { split, userId, includedId, note, staffUserId, now } = params;
    await this.decisionRepository.manager.transaction(async (em) => {
      const decisions = await em.find(ActionCohortDecision, {
        where: {
          userId,
          actionId: In(split.arms.map((arm) => arm.actionId)),
        },
        lock: { mode: "pessimistic_write" },
      });
      if (decisions.length !== split.arms.length) {
        throw new NotFoundException(
          "This member hasn't been routed to an arm of this split yet.",
        );
      }
      const changed = decisions.filter(
        (decision) => decision.included !== (decision.actionId === includedId),
      );
      if (changed.length === 0) {
        throw new BadRequestException(
          includedId === null
            ? "This member isn't in any arm of this split."
            : "This member is already in that arm.",
        );
      }
      for (const decision of changed) {
        await applyCorrection(em, {
          decision,
          included: !decision.included,
          note,
          staffUserId,
          now,
        });
      }
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

/** Replaces the decision, keeping the values it had alongside staff's note. */
async function applyCorrection(
  em: EntityManager,
  params: {
    decision: ActionCohortDecision;
    included: boolean;
    note: string;
    staffUserId: number;
    now: Date;
  },
): Promise<void> {
  const { decision, included, note, staffUserId, now } = params;
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
}
