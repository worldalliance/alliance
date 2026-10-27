import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import { sqlIsLatestWithdrawal } from "./action-activity-status";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";

/**
 * All anything resolving a form back to its action reads. A partially selected
 * `Action` would type as a whole one with most columns silently undefined, so
 * the narrow reads hand back a narrow type instead.
 */
export type LinkedAction = Pick<Action, "id" | "name">;

@Injectable()
export class ActionFormLinksService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionFormVariant)
    private readonly actionFormVariantRepository: Repository<ActionFormVariant>,
  ) {}

  async findActionByFormId(formId: number): Promise<LinkedAction | null> {
    const byFormId = await this.findActionsByFormIds([formId]);
    return byFormId.get(formId) ?? null;
  }

  /** Resolves all form IDs in at most three queries. Direct task forms take
   * precedence over variants. Narrow because listing every form would
   * otherwise materialize every linked action's markdown and image columns. */
  async findActionsByFormIds(
    formIds: number[],
  ): Promise<Map<number, LinkedAction>> {
    const byFormId = new Map<number, LinkedAction>();
    if (formIds.length === 0) {
      return byFormId;
    }
    const direct = await this.actionRepository.find({
      where: { taskFormId: In(formIds) },
      select: { id: true, name: true, taskFormId: true },
    });
    for (const action of direct) {
      if (action.taskFormId != null) {
        byFormId.set(action.taskFormId, { id: action.id, name: action.name });
      }
    }
    const remaining = formIds.filter((formId) => !byFormId.has(formId));
    if (remaining.length === 0) {
      return byFormId;
    }
    const variants = await this.actionFormVariantRepository.find({
      where: { formId: In(remaining) },
      select: { formId: true, actionId: true },
    });
    if (variants.length === 0) {
      return byFormId;
    }
    const actions = await this.actionRepository.find({
      where: { id: In(variants.map((variant) => variant.actionId)) },
      select: { id: true, name: true },
    });
    const actionById = new Map(
      actions.map((action) => [
        action.id,
        { id: action.id, name: action.name },
      ]),
    );
    for (const variant of variants) {
      const action = actionById.get(variant.actionId);
      if (action) {
        byFormId.set(variant.formId, action);
      }
    }
    return byFormId;
  }

  async assertFormIdNotUsedAsVariant(formId: number): Promise<void> {
    const variant = await this.actionFormVariantRepository.findOne({
      where: { formId },
    });
    if (variant) {
      throw new BadRequestException(
        `Form ${formId} is already used as a variant form for action ${variant.actionId}`,
      );
    }
  }

  async getWithdrawalsForForm(formId: number): Promise<ActionActivity[]> {
    const action = await this.findActionByFormId(formId);
    if (!action) {
      return [];
    }
    return this.actionActivityRepository
      .createQueryBuilder("activity")
      .where("activity.actionId = :actionId", { actionId: action.id })
      .andWhere(sqlIsLatestWithdrawal("activity"))
      .orderBy("activity.createdAt", "DESC")
      .getMany();
  }
}
