import { actionFormIds } from "@alliance/common/cohort-expression";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import { In, type Repository } from "typeorm";
import { type AssignedForm, applyAssignedForm } from "./action-branches";
import { ActionBranch } from "./entities/action-branch.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";
import { liveAssignments, variantForNewAssignment } from "./new-assignment";

@Injectable()
export class ActionFormAssignmentService {
  constructor(
    @InjectRepository(ActionFormVariant)
    private readonly variantRepo: Repository<ActionFormVariant>,
    @InjectRepository(ActionBranch)
    private readonly branchRepo: Repository<ActionBranch>,
    @InjectRepository(ActionFormAssignment)
    private readonly assignmentRepo: Repository<ActionFormAssignment>,
    @InjectRepository(Action)
    private readonly actionRepo: Repository<Action>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** The action owning each form of these actions: its task form, a variant's or a branch's. */
  async findActionIdByFormId(
    actionIds: number[],
  ): Promise<Map<number, number>> {
    if (actionIds.length === 0) return new Map();
    const [actions, variants, branches] = await Promise.all([
      this.actionRepo.find({
        where: { id: In(actionIds) },
        select: { id: true, taskFormId: true },
      }),
      this.variantRepo.find({ where: { actionId: In(actionIds) } }),
      this.branchRepo.find({ where: { actionId: In(actionIds) } }),
    ]);
    const actionIdByFormId = new Map<number, number>();
    for (const action of actions) {
      const formIds = actionFormIds({
        taskFormId: action.taskFormId,
        variantFormIds: variants
          .filter((v) => v.actionId === action.id)
          .map((v) => v.formId),
        branchFormIds: branches
          .filter((b) => b.actionId === action.id)
          .map((b) => b.formId),
      });
      for (const formId of formIds) actionIdByFormId.set(formId, action.id);
    }
    return actionIdByFormId;
  }

  /** Each action's form the member submitted: its task form, a variant's or a branch's. */
  async findSubmittedFormIds(params: {
    actionIds: number[];
    userId: number;
  }): Promise<Map<number, number>> {
    const actionIdByFormId = await this.findActionIdByFormId(params.actionIds);
    if (actionIdByFormId.size === 0) return new Map();

    const responses = await this.assignmentRepo.manager.find(FormResponse, {
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

  /**
   * The form each action assigns the member, creating random-split
   * assignments on first read. A branched action only reads the assignment its
   * cohort decision or a staff move wrote. Actions on their default form are
   * absent.
   */
  async getOrCreateAssignedForms(
    actionIds: number[],
    userId: number,
  ): Promise<Map<number, AssignedForm>> {
    if (actionIds.length === 0) return new Map();
    if (!(await this.userRepo.exists({ where: { id: userId } }))) {
      return new Map();
    }

    const [variants, branches, existing] = await Promise.all([
      this.variantRepo.find({
        where: { actionId: In(actionIds) },
        order: { id: "ASC" },
      }),
      this.branchRepo.find({ where: { actionId: In(actionIds) } }),
      this.assignmentRepo.find({ where: { actionId: In(actionIds), userId } }),
    ]);
    const variantsByAction = Map.groupBy(variants, (v) => v.actionId);
    const branchedActionIds = new Set(branches.map((b) => b.actionId));
    const assignmentByAction = new Map(existing.map((a) => [a.actionId, a]));
    const toCreate = actionIds.filter(
      (id) =>
        variantsByAction.has(id) &&
        !branchedActionIds.has(id) &&
        !assignmentByAction.has(id),
    );

    if (toCreate.length > 0) {
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
        branchId: null,
      }));
      // ON CONFLICT DO NOTHING for the live-row (actionId, userId) unique
      // index: a parallel request may have inserted first, so re-read the
      // canonical rows after.
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

    const variantById = new Map(variants.map((v) => [v.id, v]));
    const branchById = new Map(branches.map((b) => [b.id, b]));
    const result = new Map<number, AssignedForm>();
    for (const [actionId, assignment] of assignmentByAction) {
      const branch =
        assignment.branchId === null
          ? undefined
          : branchById.get(assignment.branchId);
      const variant =
        assignment.variantId === null
          ? undefined
          : variantById.get(assignment.variantId);
      if (branch) result.set(actionId, { formId: branch.formId, branch });
      else if (variant) {
        result.set(actionId, { formId: variant.formId, branch: null });
      }
    }
    return result;
  }

  /** Lays each action's assigned form, and its branch's copy, over the action as the member sees it. */
  async applyAssignedForms(
    actions: Action[],
    userId: number | undefined,
  ): Promise<void> {
    if (!userId || actions.length === 0) return;
    const assigned = await this.getOrCreateAssignedForms(
      [...new Set(actions.map((a) => a.id))],
      userId,
    );
    for (const action of actions) {
      const form = assigned.get(action.id);
      if (form) applyAssignedForm(action, form);
    }
  }

  async getOrCreateAssignedFormId(
    actionId: number,
    userId: number,
  ): Promise<number | null> {
    return (
      (await this.getOrCreateAssignedForms([actionId], userId)).get(actionId)
        ?.formId ?? null
    );
  }

  /** The member's branch of the action, without creating an assignment. */
  async findAssignedBranch(params: {
    actionId: number;
    userId: number;
  }): Promise<ActionBranch | null> {
    const assignment = await this.assignmentRepo.findOne({
      where: params,
      relations: { branch: true },
    });
    return assignment?.branch ?? null;
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
      relations: { variant: true, branch: true },
    });
    const movedToFormId = assignment?.overriddenAt
      ? (assignment.branch?.formId ?? assignment.variant?.formId)
      : undefined;
    if (movedToFormId === undefined) {
      return (
        await this.findSubmittedFormIds({ actionIds: [actionId], userId })
      ).has(actionId);
    }
    return this.assignmentRepo.manager.exists(FormResponse, {
      where: { formId: movedToFormId, user: { id: userId } },
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
    const assignedFormId = await this.getOrCreateAssignedFormId(
      actionId,
      userId,
    );
    return (assignedFormId ?? action.taskFormId) === formId;
  }
}
