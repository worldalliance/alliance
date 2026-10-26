import { rowKey } from "@alliance/common/forms/row-list";
import type {
  AssignedRow,
  RowList,
} from "@alliance/common/forms/row-list-schema";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { writeUnderLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import { IsNull, QueryFailedError, Repository } from "typeorm";
import { FormRowAssignment } from "./entities/form-row-assignment.entity";
import { Form, loadedFormSnapshot } from "./entities/form.entity";
import {
  FormResponse,
  parseFormResponse,
} from "./entities/formresponse.entity";
import { pickBalancedRow, STALE_ASSIGNMENT_DAYS } from "./form-row-pick";
import { formSchemaOf } from "./form-snapshot-schema";

@Injectable()
export class FormRowAssignmentService {
  constructor(
    @InjectRepository(FormRowAssignment)
    private readonly assignmentRepo: Repository<FormRowAssignment>,
    @InjectRepository(FormResponse)
    private readonly responseRepo: Repository<FormResponse>,
  ) {}

  /** The member's row of the form's current list; null without a list. */
  async memberRow(form: Form, userId: number): Promise<AssignedRow | null> {
    const list = formSchemaOf(loadedFormSnapshot(form)).rowList;
    return list === undefined
      ? null
      : this.rowFor({
          formId: form.id,
          userId,
          list,
        });
  }

  /** The member's row of `list`, the form's current list, assigning one if needed. */
  private async rowFor(params: {
    formId: number;
    userId: number;
    list: RowList;
  }): Promise<AssignedRow> {
    const { formId, userId, list } = params;
    const existing = await this.assignmentRepo.findOne({
      where: { formId, userId },
    });
    if (existing) {
      const current = this.rowWithKey(list, existing.rowKey);
      if (current) return current;
      const submitted = await this.submittedRow(formId, userId);
      if (submitted) return submitted;
      const replacement = await this.balancedRow(formId, list);
      await this.assignmentRepo.update(
        { id: existing.id },
        { rowKey: replacement.key, assignedAt: new Date() },
      );
      return replacement;
    }

    const picked = await this.balancedRow(formId, list);
    try {
      await writeUnderLive(this.assignmentRepo.manager, {
        parents: [
          { target: Form, id: formId },
          { target: User, id: userId },
        ],
        write: (manager) =>
          manager.insert(FormRowAssignment, {
            formId,
            userId,
            rowKey: picked.key,
          }),
      });
      return picked;
    } catch (err) {
      if (
        !(err instanceof QueryFailedError) ||
        (err as { code?: string }).code !== "23505"
      ) {
        throw err;
      }
      const fresh = await this.assignmentRepo.findOne({
        where: { formId, userId },
      });
      const row = fresh && this.rowWithKey(list, fresh.rowKey);
      if (!row) {
        throw new InternalServerErrorException(
          "Row assignment lookup failed after a unique-violation race",
        );
      }
      return row;
    }
  }

  private rowWithKey(list: RowList, key: string): AssignedRow | undefined {
    const values = list.rows.find((row) => rowKey(row, list.keyFields) === key);
    return values && { key, values };
  }

  private async submittedRow(
    formId: number,
    userId: number,
  ): Promise<AssignedRow | null> {
    const latest = await this.responseRepo.findOne({
      where: { formId, user: { id: userId }, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
    return latest ? parseFormResponse(latest).assignedRow : null;
  }

  private async balancedRow(
    formId: number,
    list: RowList,
  ): Promise<AssignedRow> {
    const counts: { rowKey: string; holders: string }[] =
      await this.assignmentRepo
        .createQueryBuilder("a")
        .select('a."rowKey"', "rowKey")
        .addSelect("count(*)", "holders")
        .where('a."formId" = :formId', { formId })
        .andWhere(
          `(a."assignedAt" > now() - make_interval(days => :staleDays) OR EXISTS (
          SELECT 1 FROM form_response r
          WHERE r."formId" = a."formId" AND r."userId" = a."userId" AND r."deletedAt" IS NULL
        ))`,
          { staleDays: STALE_ASSIGNMENT_DAYS },
        )
        .groupBy('a."rowKey"')
        .getRawMany();
    return pickBalancedRow({
      list,
      holdersByKey: new Map(counts.map((c) => [c.rowKey, Number(c.holders)])),
      random: Math.random,
    });
  }
}
