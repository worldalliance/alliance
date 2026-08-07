import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { SnapshotHistoryOwner } from 'src/tasks/entities/formsnapshot.entity';
import { FormSnapshotService } from 'src/tasks/formsnapshot.service';
import { User } from 'src/user/entities/user.entity';
import { Action } from './entities/action.entity';
import { ActionFormAssignment } from './entities/action-form-assignment.entity';
import { ActionFormVariant } from './entities/action-form-variant.entity';

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
    private readonly variantRepo: Repository<ActionFormVariant>,
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
      order: { id: 'ASC' },
    });
  }

  async createVariant(
    actionId: number,
    input: CreateVariantInput,
  ): Promise<ActionFormVariant> {
    this.assertSplitValid(input.splitValue);

    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Action not found');

    const sourceFormId = input.sourceFormId ?? action.taskFormId ?? null;
    if (sourceFormId == null) {
      throw new BadRequestException(
        'Action has no form to clone. Set the action form first or pass sourceFormId.',
      );
    }
    const sourceForm = await this.formRepo.findOne({
      where: { id: sourceFormId },
      relations: { formSnapshot: true },
    });
    if (!sourceForm) throw new NotFoundException('Source form not found');

    return this.variantRepo.manager.transaction(async (em) => {
      await this.lockActionRow(em, actionId);
      const variantTxRepo = em.getRepository(ActionFormVariant);
      await this.assertSplitTotalValid(
        actionId,
        { addValue: input.splitValue },
        variantTxRepo,
      );
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
    if (!variant) throw new NotFoundException('Variant not found');

    const nextValue = input.splitValue ?? variant.splitValue;
    this.assertSplitValid(nextValue);

    return this.variantRepo.manager.transaction(async (em) => {
      await this.lockActionRow(em, variant.actionId);
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
    });
  }

  async deleteVariant(variantId: number): Promise<void> {
    const assignmentCount = await this.assignmentRepo.count({
      where: { variantId },
    });
    if (assignmentCount > 0) {
      throw new BadRequestException(
        `Cannot delete variant: ${assignmentCount} user assignment(s) reference it. ` +
          `Variants with existing assignments must be kept.`,
      );
    }
    const result = await this.variantRepo.delete({ id: variantId });
    if (result.affected === 0) {
      throw new NotFoundException('Variant not found');
    }
  }

  async getOrCreateAssignedFormId(
    actionId: number,
    userId: number,
  ): Promise<number | null> {
    if (!(await this.userExists(userId))) return null;

    const variants = await this.listForAction(actionId);
    if (variants.length === 0) return null;

    const existing = await this.assignmentRepo.findOne({
      where: { actionId, userId },
    });
    if (existing) {
      if (existing.variantId === null) return null;
      const v = variants.find((x) => x.id === existing.variantId);
      return v?.formId ?? null;
    }

    const chosenVariantId = this.pickVariantForNewUser(variants);
    try {
      await this.assignmentRepo.insert({
        actionId,
        userId,
        variantId: chosenVariantId,
      });
    } catch (err) {
      if (
        !(err instanceof QueryFailedError) ||
        (err as { code?: string }).code !== '23505'
      ) {
        throw err;
      }
      const fresh = await this.assignmentRepo.findOne({
        where: { actionId, userId },
      });
      if (!fresh) {
        throw new InternalServerErrorException(
          'Assignment lookup failed after unique-violation race',
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

  async getOrCreateAssignedFormIdsForActions(
    actionIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    if (actionIds.length === 0) return new Map();
    if (!(await this.userExists(userId))) return new Map();

    const [allVariants, existingAssignments] = await Promise.all([
      this.variantRepo.find({
        where: { actionId: In(actionIds) },
        order: { id: 'ASC' },
      }),
      this.assignmentRepo.find({
        where: { actionId: In(actionIds), userId },
      }),
    ]);

    const variantsByAction = new Map<number, ActionFormVariant[]>();
    for (const v of allVariants) {
      const list = variantsByAction.get(v.actionId) ?? [];
      list.push(v);
      variantsByAction.set(v.actionId, list);
    }
    const assignmentByAction = new Map<number, ActionFormAssignment>();
    for (const a of existingAssignments) {
      assignmentByAction.set(a.actionId, a);
    }

    const result = new Map<number, number>();
    const inserts: {
      actionId: number;
      userId: number;
      variantId: number | null;
    }[] = [];

    for (const actionId of actionIds) {
      const variants = variantsByAction.get(actionId);
      if (!variants || variants.length === 0) continue;

      const existing = assignmentByAction.get(actionId);
      if (existing) {
        if (existing.variantId === null) continue;
        const v = variants.find((x) => x.id === existing.variantId);
        if (v) result.set(actionId, v.formId);
        continue;
      }

      const chosenVariantId = this.pickVariantForNewUser(variants);
      inserts.push({ actionId, userId, variantId: chosenVariantId });
      if (chosenVariantId !== null) {
        const v = variants.find((x) => x.id === chosenVariantId);
        if (v) result.set(actionId, v.formId);
      }
    }

    if (inserts.length === 0) return result;

    // ON CONFLICT DO NOTHING for the (actionId, userId) unique constraint —
    // a parallel request may have inserted first. After the upsert, re-read
    // to learn the canonical assignment for the conflicted rows.
    await this.assignmentRepo
      .createQueryBuilder()
      .insert()
      .values(inserts)
      .orIgnore()
      .execute();

    const insertedActionIds = inserts.map((i) => i.actionId);
    const finalAssignments = await this.assignmentRepo.find({
      where: { actionId: In(insertedActionIds), userId },
    });
    const finalByAction = new Map<number, ActionFormAssignment>();
    for (const a of finalAssignments) finalByAction.set(a.actionId, a);

    for (const i of inserts) {
      const final = finalByAction.get(i.actionId);
      if (!final) continue;
      const variants = variantsByAction.get(i.actionId);
      if (!variants) continue;
      if (final.variantId === null) {
        result.delete(i.actionId);
        continue;
      }
      const v = variants.find((x) => x.id === final.variantId);
      if (v) result.set(i.actionId, v.formId);
      else result.delete(i.actionId);
    }

    return result;
  }

  async getStatsForAction(actionId: number): Promise<VariantStats[]> {
    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Action not found');

    const variants = await this.listForAction(actionId);

    const assignmentCounts = (await this.assignmentRepo
      .createQueryBuilder('a')
      .select('a.variantId', 'variantId')
      .addSelect('COUNT(*)::int', 'count')
      .where('a.actionId = :actionId', { actionId })
      .groupBy('a.variantId')
      .getRawMany()) as { variantId: number | null; count: number }[];
    const assignedByVariant = new Map<number | null, number>();
    for (const row of assignmentCounts) {
      assignedByVariant.set(row.variantId ?? null, row.count);
    }

    const submittedRaw = (await this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoin(ActionFormVariant, 'v', 'v.id = a.variantId')
      .innerJoin(
        FormResponse,
        'r',
        'r."userId" = a."userId" AND r."formId" = COALESCE(v."formId", :defaultFormId)',
        { defaultFormId: action.taskFormId ?? -1 },
      )
      .select('a.variantId', 'variantId')
      .addSelect('COUNT(*)::int', 'count')
      .where('a.actionId = :actionId', { actionId })
      .groupBy('a.variantId')
      .getRawMany()) as { variantId: number | null; count: number }[];
    const submittedByVariant = new Map<number | null, number>();
    for (const row of submittedRaw) {
      submittedByVariant.set(row.variantId ?? null, row.count);
    }

    const stats: VariantStats[] = [];
    stats.push({
      variantId: null,
      name: 'Default',
      formId: action.taskFormId ?? null,
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

  async validateFormIdForUser(params: {
    actionId: number;
    userId: number;
    formId: number;
  }): Promise<boolean> {
    const { actionId, userId, formId } = params;
    const action = await this.actionRepo.findOne({ where: { id: actionId } });
    if (!action) return false;

    const variants = await this.listForAction(actionId);
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

  private pickVariantForNewUser(variants: ActionFormVariant[]): number | null {
    if (variants.length === 0) return null;

    const r = Math.random();
    let acc = 0;
    for (const v of variants) {
      acc += v.splitValue;
      if (r < acc) return v.id;
    }
    return null;
  }

  private async userExists(userId: number): Promise<boolean> {
    return this.userRepo.exists({ where: { id: userId } });
  }

  private assertSplitValid(splitValue: number): void {
    if (
      typeof splitValue !== 'number' ||
      !Number.isFinite(splitValue) ||
      splitValue < 0 ||
      splitValue > 1
    ) {
      throw new BadRequestException(
        'splitValue must be a number between 0 and 1',
      );
    }
  }

  private async lockActionRow(
    em: EntityManager,
    actionId: number,
  ): Promise<void> {
    await em
      .getRepository(Action)
      .createQueryBuilder('a')
      .setLock('pessimistic_write')
      .where('a.id = :id', { id: actionId })
      .getOne();
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
