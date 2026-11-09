import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteWhere, writeUnderLive } from "src/datasources/soft-delete";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { Repository } from "typeorm";
import {
  cloneFormIntoAction,
  findSourceForm,
  isUnlaunchedAndUnanswered,
} from "./action-arm-forms";
import { ActionBranch } from "./entities/action-branch.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";
import { lockActionRow } from "./lock-action-row";

export interface CreateVariantInput {
  name: string;
  splitValue: number;
  sourceFormId?: number | null;
}

export interface UpdateVariantInput {
  name?: string;
  splitValue?: number;
}

export interface VariantStats {
  variantId: number | null;
  name: string;
  formId: number | null;
  splitValue: number | null;
  assigned: number;
  submitted: number;
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
    private readonly formSnapshotService: FormSnapshotService,
  ) {}

  async listForAction(actionId: number): Promise<ActionFormVariant[]> {
    return this.variantRepo.find({
      where: { actionId },
      order: { id: "ASC" },
    });
  }

  async createVariant(
    actionId: number,
    input: CreateVariantInput,
  ): Promise<ActionFormVariant> {
    this.assertSplitValid(input.splitValue);

    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) throw new NotFoundException("Action not found");

    const sourceForm = await findSourceForm(this.variantRepo.manager, {
      action,
      sourceFormId: input.sourceFormId,
    });

    return this.variantRepo.manager.transaction(async (em) => {
      await lockActionRow(em, actionId);
      if (await em.existsBy(ActionBranch, { actionId })) {
        throw new BadRequestException(
          "This action routes members by branch rules, so it can't also take a random split. Delete its branches first.",
        );
      }
      const variantTxRepo = em.getRepository(ActionFormVariant);
      await this.assertSplitTotalValid(
        actionId,
        { addValue: input.splitValue },
        variantTxRepo,
      );
      const newForm = await cloneFormIntoAction(em, {
        sourceForm,
        actionId,
        formSnapshotService: this.formSnapshotService,
      });
      return variantTxRepo.save(
        variantTxRepo.create({
          actionId,
          formId: newForm.id,
          name: input.name,
          splitValue: input.splitValue,
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

    const nextValue = input.splitValue ?? variant.splitValue;
    this.assertSplitValid(nextValue);

    return this.variantRepo.manager.transaction(async (em) => {
      await lockActionRow(em, variant.actionId);
      return writeUnderLive(em, {
        saved: {
          target: ActionFormVariant,
          id: variantId,
          notFound: "Variant not found",
        },
        write: async () => {
          const variantTxRepo = em.getRepository(ActionFormVariant);
          await this.assertSplitTotalValid(
            variant.actionId,
            {
              excludeVariantId: variantId,
              addValue: nextValue,
            },
            variantTxRepo,
          );
          Object.assign(variant, {
            ...(input.name !== undefined ? { name: input.name } : {}),
            splitValue: nextValue,
          });
          return variantTxRepo.save(variant);
        },
      });
    });
  }

  async deleteVariant(variantId: number): Promise<void> {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException("Variant not found");
    if (await isUnlaunchedAndUnanswered(this.variantRepo.manager, variant)) {
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
      .andWhere('a."branchId" IS NULL')
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
      .andWhere('a."branchId" IS NULL')
      .groupBy("a.variantId")
      .getRawMany()) as { variantId: number | null; count: number }[];
    const submittedByVariant = new Map<number | null, number>();
    for (const row of submittedRaw) {
      submittedByVariant.set(row.variantId ?? null, row.count);
    }

    const stats: VariantStats[] = [];
    stats.push({
      variantId: null,
      name: "Default",
      formId: action.taskFormId,
      splitValue: null,
      assigned: assignedByVariant.get(null) ?? 0,
      submitted: submittedByVariant.get(null) ?? 0,
    });
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
      .reduce((s, v) => s + v.splitValue, 0);
    if (sum + opts.addValue > 1) {
      throw new BadRequestException(
        `Total split across variants would exceed 1 ` +
          `(${sum} existing + ${opts.addValue} new). ` +
          `The default form covers the remainder.`,
      );
    }
  }
}
