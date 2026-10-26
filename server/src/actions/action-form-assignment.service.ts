import { actionFormIds } from "@alliance/common/cohort-expression";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import { In, QueryFailedError, type Repository } from "typeorm";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import {
  ActionFormVariant,
  isRuleRouted,
} from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";
import { liveAssignments, variantForNewAssignment } from "./new-assignment";

@Injectable()
export class ActionFormAssignmentService {
  constructor(
    @InjectRepository(ActionFormVariant)
    private readonly variantRepo: Repository<ActionFormVariant>,
    @InjectRepository(ActionFormAssignment)
    private readonly assignmentRepo: Repository<ActionFormAssignment>,
    @InjectRepository(Action)
    private readonly actionRepo: Repository<Action>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** The action owning each form of these actions: its task form or a variant's. */
  async findActionIdByFormId(
    actionIds: number[],
  ): Promise<Map<number, number>> {
    if (actionIds.length === 0) return new Map();
    const [actions, variants] = await Promise.all([
      this.actionRepo.find({
        where: { id: In(actionIds) },
        select: { id: true, taskFormId: true },
      }),
      this.variantRepo.find({ where: { actionId: In(actionIds) } }),
    ]);
    const actionIdByFormId = new Map<number, number>();
    for (const action of actions) {
      const formIds = actionFormIds({
        taskFormId: action.taskFormId,
        variantFormIds: variants
          .filter((v) => v.actionId === action.id)
          .map((v) => v.formId),
      });
      for (const formId of formIds) actionIdByFormId.set(formId, action.id);
    }
    return actionIdByFormId;
  }

  /** Each action's form the member submitted: its task form or a variant's. */
  async findSubmittedFormIds(params: {
    actionIds: number[];
    userId: number;
  }): Promise<Map<number, number>> {
    const actionIdByFormId = await this.findActionIdByFormId(params.actionIds);
    if (actionIdByFormId.size === 0) return new Map();

    const responses = await this.variantRepo.manager.find(FormResponse, {
      where: {
        formId: In([...actionIdByFormId.keys()]),
        user: { id: params.userId },
      },
      select: { formId: true },
    });
    const submitted = new Map<number, number>();
    for (const { formId } of responses) {
      const actionId = actionIdByFormId.get(formId);
      if (actionId !== undefined) submitted.set(actionId, formId);
    }
    return submitted;
  }

  async getOrCreateAssignedFormId(
    actionId: number,
    userId: number,
  ): Promise<number | null> {
    if (!(await this.userExists(userId))) return null;

    const variants = await this.variantRepo.find({
      where: { actionId },
      order: { position: "ASC", id: "ASC" },
    });
    if (variants.length === 0) return null;

    const existing = await this.assignmentRepo.findOne({
      where: { actionId, userId },
    });
    if (existing) {
      if (existing.variantId === null) return null;
      const v = variants.find((x) => x.id === existing.variantId);
      return v?.formId ?? null;
    }
    if (isRuleRouted(variants)) return null;

    const submitted = await this.findSubmittedFormIds({
      actionIds: [actionId],
      userId,
    });
    const chosenVariantId = variantForNewAssignment({
      variants,
      submittedFormId: submitted.get(actionId),
    });
    try {
      const inserted = await this.assignmentRepo.manager.transaction(
        async (em) => {
          const [live] = await liveAssignments(em, [
            { actionId, userId, variantId: chosenVariantId },
          ]);
          if (!live) return false;
          await em.insert(ActionFormAssignment, live);
          return true;
        },
      );
      if (!inserted) return null;
    } catch (err) {
      if (
        !(err instanceof QueryFailedError) ||
        (err as { code?: string }).code !== "23505"
      ) {
        throw err;
      }
      const fresh = await this.assignmentRepo.findOne({
        where: { actionId, userId },
      });
      if (!fresh) {
        throw new InternalServerErrorException(
          "Assignment lookup failed after unique-violation race",
        );
      }
      if (fresh.variantId === null) return null;
      const v = variants.find((x) => x.id === fresh.variantId);
      return v?.formId ?? null;
    }
    if (chosenVariantId === null) return null;
    const v = variants.find((x) => x.id === chosenVariantId);
    return v?.formId ?? null;
  }

  /**
   * The variant each action assigns the member, creating random-split
   * assignments on first read. A branched action only reads the assignment its
   * cohort decision wrote.
   */
  async getOrCreateAssignedVariantsForActions(
    actionIds: number[],
    userId: number,
  ): Promise<Map<number, ActionFormVariant>> {
    if (actionIds.length === 0) return new Map();
    if (!(await this.userExists(userId))) return new Map();

    const [allVariants, existingAssignments] = await Promise.all([
      this.variantRepo.find({
        where: { actionId: In(actionIds) },
        order: { position: "ASC", id: "ASC" },
      }),
      this.assignmentRepo.find({
        where: { actionId: In(actionIds), userId },
      }),
    ]);

    const variantsByAction = Map.groupBy(allVariants, (v) => v.actionId);
    const assignmentByAction = new Map(
      existingAssignments.map((a) => [a.actionId, a]),
    );
    const toCreate = actionIds.filter((id) => {
      const variants = variantsByAction.get(id);
      return (
        variants !== undefined &&
        !isRuleRouted(variants) &&
        !assignmentByAction.has(id)
      );
    });

    const submitted = await this.findSubmittedFormIds({
      actionIds: toCreate,
      userId,
    });
    const inserts = toCreate.map((actionId) => ({
      actionId,
      userId,
      variantId: variantForNewAssignment({
        variants: variantsByAction.get(actionId) ?? [],
        submittedFormId: submitted.get(actionId),
      }),
    }));

    if (inserts.length > 0) {
      // ON CONFLICT DO NOTHING for the live-row (actionId, userId) unique
      // index — a parallel request may have inserted first. After the upsert,
      // re-read to learn the canonical assignment for the conflicted rows.
      await this.assignmentRepo.manager.transaction(async (em) => {
        const live = await liveAssignments(em, inserts);
        if (live.length === 0) return;
        await em
          .createQueryBuilder()
          .insert()
          .into(ActionFormAssignment)
          .values(live)
          .orIgnore()
          .execute();
      });
      for (const assignment of await this.assignmentRepo.find({
        where: { actionId: In(toCreate), userId },
      })) {
        assignmentByAction.set(assignment.actionId, assignment);
      }
    }

    const result = new Map<number, ActionFormVariant>();
    for (const [actionId, assignment] of assignmentByAction) {
      const variant = variantsByAction
        .get(actionId)
        ?.find((v) => v.id === assignment.variantId);
      if (variant) result.set(actionId, variant);
    }
    return result;
  }

  /** The member's assigned variant, without creating an assignment. */
  async findAssignedVariant(params: {
    actionId: number;
    userId: number;
  }): Promise<ActionFormVariant | null> {
    const assignment = await this.assignmentRepo.findOne({
      where: params,
      relations: { variant: true },
    });
    return assignment?.variant ?? null;
  }

  /**
   * Whether the member submitted the action: any of its forms, or for a
   * member staff moved, the form they're on now, so they can submit its form.
   */
  async hasSubmittedAssignedForm(params: {
    actionId: number;
    userId: number;
  }): Promise<boolean> {
    const { actionId, userId } = params;
    const assignment = await this.assignmentRepo.findOne({
      where: params,
      relations: { variant: true },
    });
    if (!assignment?.overriddenAt || !assignment.variant) {
      return (
        await this.findSubmittedFormIds({ actionIds: [actionId], userId })
      ).has(actionId);
    }
    return this.variantRepo.manager.exists(FormResponse, {
      where: { formId: assignment.variant.formId, user: { id: userId } },
    });
  }

  async validateFormIdForUser(params: {
    actionId: number;
    userId: number;
    formId: number;
  }): Promise<boolean> {
    const { actionId, userId, formId } = params;
    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) return false;

    const variants = await this.variantRepo.find({
      where: { actionId },
      order: { position: "ASC", id: "ASC" },
    });
    if (variants.length === 0) {
      return action.taskFormId === formId;
    }
    const assignedFormId = await this.getOrCreateAssignedFormId(
      actionId,
      userId,
    );
    if (assignedFormId === null) return action.taskFormId === formId;
    return assignedFormId === formId;
  }

  private async userExists(userId: number): Promise<boolean> {
    return this.userRepo.exists({ where: { id: userId } });
  }
}
