import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteWhere, writeUnderLive } from "src/datasources/soft-delete";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { type EntityManager, type Repository } from "typeorm";
import {
  cloneFormIntoAction,
  findSourceForm,
  isUnlaunchedAndUnanswered,
} from "./action-arm-forms";
import { sortBranches } from "./action-branches";
import { parseCohortExpressionForSaveOrThrow } from "./cohort-reference-validation";
import { ActionBranch } from "./entities/action-branch.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";
import { lockActionRow } from "./lock-action-row";

export type BranchCopyOverrides = Partial<
  Pick<
    ActionBranch,
    | "nameOverride"
    | "shortDescriptionOverride"
    | "bodyOverride"
    | "timeEstimateOverride"
    | "imageOverride"
    | "squareThumbnailImageOverride"
    | "squareThumbnailImageAltOverride"
  >
>;

export type CreateBranchInput = BranchCopyOverrides & {
  name: string;
  rule: unknown;
  sourceFormId?: number | null;
};

export type UpdateBranchInput = BranchCopyOverrides & {
  name?: string;
  rule?: unknown;
};

export type BranchStats = {
  branchId: number;
  assigned: number;
  submitted: number;
};

@Injectable()
export class ActionBranchAdminService {
  constructor(
    @InjectRepository(ActionBranch)
    private readonly branchRepo: Repository<ActionBranch>,
    @InjectRepository(ActionFormAssignment)
    private readonly assignmentRepo: Repository<ActionFormAssignment>,
    @InjectRepository(Action)
    private readonly actionRepo: Repository<Action>,
    private readonly formSnapshotService: FormSnapshotService,
  ) {}

  async listForAction(actionId: number): Promise<ActionBranch[]> {
    return sortBranches(await this.branchRepo.find({ where: { actionId } }));
  }

  async getStatsForAction(actionId: number): Promise<BranchStats[]> {
    const branches = await this.listForAction(actionId);
    const rows = await this.assignmentRepo
      .createQueryBuilder("a")
      .innerJoin(ActionBranch, "b", 'b.id = a."branchId"')
      .leftJoin(
        FormResponse,
        "r",
        'r."userId" = a."userId" AND r."formId" = b."formId"',
      )
      .select('a."branchId"', "branchId")
      .addSelect('COUNT(DISTINCT a."userId")::int', "assigned")
      .addSelect('COUNT(DISTINCT r."userId")::int', "submitted")
      .where('a."actionId" = :actionId', { actionId })
      .groupBy('a."branchId"')
      .getRawMany<BranchStats>();
    const byBranch = new Map(rows.map((row) => [row.branchId, row]));
    return branches.map((branch) => ({
      branchId: branch.id,
      assigned: byBranch.get(branch.id)?.assigned ?? 0,
      submitted: byBranch.get(branch.id)?.submitted ?? 0,
    }));
  }

  async create(
    actionId: number,
    input: CreateBranchInput,
  ): Promise<ActionBranch> {
    const { name, rule, sourceFormId, ...overrides } = input;
    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) throw new NotFoundException("Action not found");
    if (action.publicOnly) {
      throw new BadRequestException(
        "A public-only action makes no cohort decisions, so it can't route members to branches.",
      );
    }
    const em = this.branchRepo.manager;
    const parsedRule = await parseCohortExpressionForSaveOrThrow({
      em,
      value: rule,
    });
    const sourceForm = await findSourceForm(em, { action, sourceFormId });

    return em.transaction(async (tx) => {
      await lockActionRow(tx, actionId);
      if (await tx.existsBy(ActionFormVariant, { actionId })) {
        throw new BadRequestException(
          "This action splits members into random variants, so it can't also route them by branch rules. Delete its variants first.",
        );
      }
      const siblings = await tx.findBy(ActionBranch, { actionId });
      const form = await cloneFormIntoAction(tx, {
        sourceForm,
        actionId,
        formSnapshotService: this.formSnapshotService,
      });
      return tx.save(
        tx.create(ActionBranch, {
          ...overrides,
          actionId,
          formId: form.id,
          name,
          rule: parsedRule,
          position: Math.max(-1, ...siblings.map((b) => b.position)) + 1,
        }),
      );
    });
  }

  async update(
    branchId: number,
    input: UpdateBranchInput,
  ): Promise<ActionBranch> {
    const { rule, ...rest } = input;
    const branch = await this.findOrFail(branchId);
    const parsedRule =
      rule === undefined
        ? undefined
        : await parseCohortExpressionForSaveOrThrow({
            em: this.branchRepo.manager,
            value: rule,
            stored: branch.rule,
          });
    return this.branchRepo.manager.transaction(async (em) => {
      await lockActionRow(em, branch.actionId);
      return writeUnderLive(em, {
        saved: {
          target: ActionBranch,
          id: branchId,
          notFound: "Branch not found",
        },
        write: async () => {
          Object.assign(branch, rest);
          if (parsedRule !== undefined) branch.rule = parsedRule;
          return em.save(branch);
        },
      });
    });
  }

  /** Before launch, deletes the branch's assignments with it; after, only a branch nobody is on. */
  async delete(branchId: number): Promise<void> {
    const branch = await this.findOrFail(branchId);
    const withAssignments = await isUnlaunchedAndUnanswered(
      this.branchRepo.manager,
      branch,
    );
    await this.branchRepo.manager.transaction(async (em) => {
      // Waits out an assignment being written, so the checks below see it.
      await em.findOne(ActionBranch, {
        where: { id: branchId },
        lock: { mode: "pessimistic_write" },
      });
      if (withAssignments) {
        await softDeleteWhere(em, {
          target: ActionFormAssignment,
          where: { branchId },
        });
      } else {
        await this.assertNoAssignments(em, branchId);
      }
      const deleted = await softDeleteWhere(em, {
        target: ActionBranch,
        where: { id: branchId },
      });
      if (deleted === 0) throw new NotFoundException("Branch not found");
    });
  }

  async reorder(params: {
    actionId: number;
    branchIds: number[];
  }): Promise<void> {
    const { actionId, branchIds } = params;
    await this.branchRepo.manager.transaction(async (em) => {
      await lockActionRow(em, actionId);
      const live = await em.findBy(ActionBranch, { actionId });
      const liveIds = new Set(live.map((b) => b.id));
      if (
        branchIds.length !== live.length ||
        !branchIds.every((id) => liveIds.has(id))
      ) {
        throw new BadRequestException(
          "Send every branch of this action exactly once. The branches may have changed; reload and try again.",
        );
      }
      for (const [position, id] of branchIds.entries()) {
        await em.update(ActionBranch, id, { position });
      }
    });
  }

  private async findOrFail(branchId: number): Promise<ActionBranch> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async assertNoAssignments(
    em: EntityManager,
    branchId: number,
  ): Promise<void> {
    const count = await em.count(ActionFormAssignment, { where: { branchId } });
    if (count > 0) {
      throw new BadRequestException(
        `Cannot delete this branch: ${count} member(s) are on it. Move them to another branch first.`,
      );
    }
  }
}
