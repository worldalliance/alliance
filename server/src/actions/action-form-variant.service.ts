import { hasMemberActionStarted } from "@alliance/common/actionEvent";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteWhere, writeUnderLive } from "src/datasources/soft-delete";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { SnapshotHistoryOwner } from "src/tasks/entities/formsnapshot.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { User } from "src/user/entities/user.entity";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { EntityManager, Repository } from "typeorm";
import { parseCohortExpressionForSaveOrThrow } from "./cohort-reference-validation";
import { ActionEvent } from "./entities/action-event.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import {
  ActionFormVariant,
  isRuleRouted,
} from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";

export type VariantCopyOverrides = Pick<
  ActionFormVariant,
  | "nameOverride"
  | "shortDescriptionOverride"
  | "bodyOverride"
  | "timeEstimateOverride"
  | "imageOverride"
  | "squareThumbnailImageOverride"
  | "squareThumbnailImageAltOverride"
>;

export interface CreateVariantInput extends Partial<VariantCopyOverrides> {
  name: string;
  splitValue?: number | null;
  rule?: unknown;
  sourceFormId?: number | null;
}

export interface UpdateVariantInput extends Partial<VariantCopyOverrides> {
  name?: string;
  splitValue?: number;
  rule?: unknown;
}

export interface VariantStats {
  variantId: number | null;
  name: string;
  formId: number | null;
  splitValue: number | null;
  assigned: number;
  submitted: number;
}

function copyOverrides(
  input: Partial<VariantCopyOverrides>,
): Partial<VariantCopyOverrides> {
  return Object.fromEntries(
    Object.entries({
      nameOverride: input.nameOverride,
      shortDescriptionOverride: input.shortDescriptionOverride,
      bodyOverride: input.bodyOverride,
      timeEstimateOverride: input.timeEstimateOverride,
      imageOverride: input.imageOverride,
      squareThumbnailImageOverride: input.squareThumbnailImageOverride,
      squareThumbnailImageAltOverride: input.squareThumbnailImageAltOverride,
    }).filter(([, value]) => value !== undefined),
  );
}

@Injectable()
export class ActionFormVariantService {
  constructor(
    @InjectRepository(ActionFormVariant)
    private readonly variantRepo: TypedRepository<ActionFormVariant>,
    @InjectRepository(ActionFormAssignment)
    private readonly assignmentRepo: Repository<ActionFormAssignment>,
    @InjectRepository(Action)
    private readonly actionRepo: Repository<Action>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Form)
    private readonly formRepo: Repository<Form>,
    private readonly formSnapshotService: FormSnapshotService,
  ) {}

  async listForAction(actionId: number): Promise<ActionFormVariant[]> {
    return this.variantRepo.find({
      where: { actionId },
      order: { position: "ASC", id: "ASC" },
    });
  }

  async createVariant(
    actionId: number,
    input: CreateVariantInput,
  ): Promise<ActionFormVariant> {
    const { splitValue = null, rule: rawRule = null } = input;
    if ((splitValue === null) === (rawRule === null)) {
      throw new BadRequestException(
        "A variant takes either a splitValue or a rule, not both or neither.",
      );
    }
    if (splitValue !== null) this.assertSplitValid(splitValue);

    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) throw new NotFoundException("Action not found");
    if (rawRule !== null && action.publicOnly) {
      throw new BadRequestException(
        "A public-only action has no cohort decisions, so it can't route members by branch.",
      );
    }
    const rule =
      rawRule === null
        ? null
        : await parseCohortExpressionForSaveOrThrow({
            em: this.variantRepo.manager,
            value: rawRule,
          });

    const sourceFormId = input.sourceFormId ?? action.taskFormId ?? null;
    if (sourceFormId == null) {
      throw new BadRequestException(
        "Action has no form to clone. Set the action form first or pass sourceFormId.",
      );
    }
    const sourceForm = await this.formRepo.findOne({
      where: { id: sourceFormId },
      relations: { formSnapshot: true },
    });
    if (!sourceForm) throw new NotFoundException("Source form not found");

    return this.variantRepo.manager.transaction(async (em) => {
      await this.lockActionRow(em, actionId);
      const variantTxRepo = em.getRepository(ActionFormVariant);
      const existing = await variantTxRepo.find({ where: { actionId } });
      if (existing.length > 0 && isRuleRouted(existing) !== (rule !== null)) {
        throw new BadRequestException(
          isRuleRouted(existing)
            ? "This action routes members by branch rules, so it can't also take a random split."
            : "This action splits members at random, so it can't also take branch rules.",
        );
      }
      if (splitValue !== null) {
        await this.assertSplitTotalValid(
          actionId,
          { addValue: splitValue },
          variantTxRepo,
        );
      }
      const formTxRepo = em.getRepository(Form);
      const newForm = await formTxRepo.save(
        formTxRepo.create({
          title: sourceForm.title,
          formSnapshotId: sourceForm.formSnapshotId,
          formSnapshot: sourceForm.formSnapshot,
        }),
      );
      await this.formSnapshotService.recordHistorical({
        owner: SnapshotHistoryOwner.Form,
        ownerId: newForm.id,
        snapshotId: sourceForm.formSnapshotId,
        em,
      });
      return variantTxRepo.save(
        variantTxRepo.create({
          ...copyOverrides(input),
          actionId,
          formId: newForm.id,
          name: input.name,
          splitValue,
          rule,
          position:
            rule === null
              ? 0
              : Math.max(-1, ...existing.map((v) => v.position)) + 1,
        }),
      );
    });
  }

  async updateVariant(
    variantId: number,
    input: UpdateVariantInput,
  ): Promise<ActionFormVariant> {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException("Variant not found");
    if (input.splitValue !== undefined && variant.splitValue === null) {
      throw new BadRequestException("A branch takes a rule, not a splitValue.");
    }
    if (input.rule !== undefined && variant.rule === null) {
      throw new BadRequestException(
        "A random-split variant takes a splitValue, not a rule.",
      );
    }
    const nextValue = input.splitValue ?? variant.splitValue;
    if (nextValue !== null) this.assertSplitValid(nextValue);
    const rule =
      input.rule === undefined
        ? undefined
        : await parseCohortExpressionForSaveOrThrow({
            em: this.variantRepo.manager,
            value: input.rule,
            stored: variant.rule,
          });

    return this.variantRepo.manager.transaction(async (em) => {
      await this.lockActionRow(em, variant.actionId);
      return writeUnderLive(em, {
        saved: {
          target: ActionFormVariant,
          id: variantId,
          notFound: "Variant not found",
        },
        write: async () => {
          const variantTxRepo = em.getRepository(ActionFormVariant);
          if (nextValue !== null) {
            await this.assertSplitTotalValid(
              variant.actionId,
              {
                excludeVariantId: variantId,
                addValue: nextValue,
              },
              variantTxRepo,
            );
          }
          Object.assign(variant, {
            ...copyOverrides(input),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(rule !== undefined ? { rule } : {}),
            splitValue: nextValue,
          });
          return variantTxRepo.save(variant);
        },
      });
    });
  }

  /** Sets the routing order of an action's branches to `variantIds`, which must name each of them once. */
  async reorderBranches(params: {
    actionId: number;
    variantIds: number[];
  }): Promise<ActionFormVariant[]> {
    const { actionId, variantIds } = params;
    await this.variantRepo.manager.transaction(async (em) => {
      await this.lockActionRow(em, actionId);
      const branches = (
        await em.find(ActionFormVariant, { where: { actionId } })
      ).filter((v) => v.rule != null);
      const ids = new Set(branches.map((v) => v.id));
      if (
        variantIds.length !== ids.size ||
        new Set(variantIds).size !== ids.size ||
        variantIds.some((id) => !ids.has(id))
      ) {
        throw new BadRequestException(
          "Send every branch of the action exactly once.",
        );
      }
      for (const [position, id] of variantIds.entries()) {
        await em.update(ActionFormVariant, id, { position });
      }
    });
    return this.listForAction(actionId);
  }

  async deleteVariant(variantId: number): Promise<void> {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException("Variant not found");
    const events = await this.variantRepo.manager.findBy(ActionEvent, {
      action: { id: variant.actionId },
    });

    // Clients only submit once member_action starts, so a response means
    // members were assigned after a launch whose member_action event later
    // moved or was deleted.
    if (
      !hasMemberActionStarted(events, new Date()) &&
      !(await this.variantRepo.manager.existsBy(FormResponse, {
        formId: variant.formId,
      }))
    ) {
      await this.variantRepo.manager.transaction(async (em) => {
        // Waits out an assignment being written, so the deletion below sees it.
        await em.findOne(ActionFormVariant, {
          where: { id: variantId },
          lock: { mode: "pessimistic_write" },
        });
        await softDeleteWhere(em, {
          target: ActionFormAssignment,
          where: { variantId },
        });
        await softDeleteWhere(em, {
          target: ActionFormVariant,
          where: { id: variantId },
        });
      });
      return;
    }

    const assignmentCount = await this.assignmentRepo.count({
      where: { variantId },
    });
    if (assignmentCount > 0) {
      throw new BadRequestException(
        `Cannot delete variant: ${assignmentCount} user assignment(s) reference it. ` +
          `Variants with existing assignments must be kept.`,
      );
    }
    const deleted = await softDeleteWhere(this.variantRepo.manager, {
      target: ActionFormVariant,
      where: { id: variantId },
    });
    if (deleted === 0) {
      throw new NotFoundException("Variant not found");
    }
  }

  async getStatsForAction(actionId: number): Promise<VariantStats[]> {
    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) throw new NotFoundException("Action not found");

    const variants = await this.listForAction(actionId);

    const assignmentCounts = (await this.assignmentRepo
      .createQueryBuilder("a")
      .select("a.variantId", "variantId")
      .addSelect("COUNT(*)::int", "count")
      .where("a.actionId = :actionId", { actionId })
      .groupBy("a.variantId")
      .getRawMany()) as { variantId: number | null; count: number }[];
    const assignedByVariant = new Map<number | null, number>();
    for (const row of assignmentCounts) {
      assignedByVariant.set(row.variantId ?? null, row.count);
    }

    const submittedRaw = (await this.assignmentRepo
      .createQueryBuilder("a")
      .leftJoin(ActionFormVariant, "v", "v.id = a.variantId")
      .innerJoin(
        FormResponse,
        "r",
        'r."userId" = a."userId" AND r."formId" = COALESCE(v."formId", :defaultFormId)',
        { defaultFormId: action.taskFormId ?? -1 },
      )
      .select("a.variantId", "variantId")
      .addSelect("COUNT(*)::int", "count")
      .where("a.actionId = :actionId", { actionId })
      .groupBy("a.variantId")
      .getRawMany()) as { variantId: number | null; count: number }[];
    const submittedByVariant = new Map<number | null, number>();
    for (const row of submittedRaw) {
      submittedByVariant.set(row.variantId ?? null, row.count);
    }

    const stats: VariantStats[] = [];
    if (!isRuleRouted(variants)) {
      stats.push({
        variantId: null,
        name: "Default",
        formId: action.taskFormId ?? null,
        splitValue: null,
        assigned: assignedByVariant.get(null) ?? 0,
        submitted: submittedByVariant.get(null) ?? 0,
      });
    }
    for (const v of variants) {
      stats.push({
        variantId: v.id,
        name: v.name,
        formId: v.formId,
        splitValue: v.splitValue,
        assigned: assignedByVariant.get(v.id) ?? 0,
        submitted: submittedByVariant.get(v.id) ?? 0,
      });
    }
    return stats;
  }

  private assertSplitValid(splitValue: number): void {
    if (
      typeof splitValue !== "number" ||
      !Number.isFinite(splitValue) ||
      splitValue < 0 ||
      splitValue > 1
    ) {
      throw new BadRequestException(
        "splitValue must be a number between 0 and 1",
      );
    }
  }

  private async lockActionRow(
    em: EntityManager,
    actionId: number,
  ): Promise<void> {
    const action = await em
      .getRepository(Action)
      .createQueryBuilder("a")
      .setLock("pessimistic_write")
      .where("a.id = :id", { id: actionId })
      .getOne();
    if (!action) {
      throw new NotFoundException("Action not found");
    }
  }

  private async assertSplitTotalValid(
    actionId: number,
    opts: {
      excludeVariantId?: number;
      addValue: number;
    },
    repo: Repository<ActionFormVariant> = this.variantRepo,
  ): Promise<void> {
    const others = await repo.find({ where: { actionId } });
    const sum = others
      .filter((v) => v.id !== opts.excludeVariantId)
      .reduce((s, v) => s + (v.splitValue ?? 0), 0);
    if (sum + opts.addValue > 1) {
      throw new BadRequestException(
        `Total split across variants would exceed 1 ` +
          `(${sum} existing + ${opts.addValue} new). ` +
          `The default form covers the remainder.`,
      );
    }
  }
}
