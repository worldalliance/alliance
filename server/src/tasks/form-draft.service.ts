import {
  FORM_DRAFT_MAX_ANSWER_BYTES,
  readFormAnswers,
  readPublicFormAnswers,
} from "@alliance/common/forms/form-responses";
import {
  FormSchema,
  isQuestionField,
} from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { Action } from "src/actions/entities/action.entity";
import { softDeleteWhere, writeUnderLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import { type Repository } from "typeorm";
import { assertActionNotSubmitted } from "./assert-action-not-submitted";
import { Form } from "./entities/form.entity";
import {
  FormResponseDraft,
  type ParsedFormResponseDraft,
  parseFormResponseDraft,
} from "./entities/formresponsedraft.entity";
import { FormRowAssignmentService } from "./form-row-assignment.service";
import { formSchemaOf } from "./form-snapshot-schema";
import { type FormDraft, SaveFormDraftDto } from "./form.dto";
import { FormSnapshotService } from "./formsnapshot.service";
import { TasksService } from "./tasks.service";

function pickKeys<T>(
  values: Record<string, T>,
  allowed: Set<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => allowed.has(key)),
  );
}

@Injectable()
export class FormDraftService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly formRowAssignmentService: FormRowAssignmentService,
    @InjectRepository(FormResponseDraft)
    private formResponseDraftRepository: Repository<FormResponseDraft>,
    private formSnapshotService: FormSnapshotService,
    private actionFormVariantService: ActionFormVariantService,
  ) {}

  /**
   * Upserts the caller's in-progress answers for a task form. A draft leaves
   * no trace in feeds, counts or reminders, so it deliberately skips what
   * `FormSubmissionService.submitForm` does around the save: required-field
   * validation, hidden-answer stripping, profile auto-extraction, contract
   * signing, AI detection, and the completion activity.
   */
  async saveFormDraft(params: {
    userId: number;
    formId: number;
    dto: SaveFormDraftDto;
  }): Promise<FormDraft> {
    const { userId, formId, dto } = params;
    const form = await this.tasksService.getForm(formId);

    const valid = await this.actionFormVariantService.validateFormIdForUser({
      actionId: dto.actionId,
      userId,
      formId,
    });
    if (!valid) {
      throw new ForbiddenException(
        "This form is not the variant assigned to you for this action",
      );
    }

    await assertActionNotSubmitted(this.actionFormVariantService, {
      actionId: dto.actionId,
      userId,
    });

    const snapshot = await this.formSnapshotService.resolveSubmissionSnapshot({
      form,
      dto,
      assignedRow: await this.formRowAssignmentService.memberRow(form, userId),
    });
    const answers = readFormAnswers(dto.answers);
    if (R.isFailure(answers)) {
      throw new BadRequestException("Draft answers are not a valid answer map");
    }
    const publicAnswers = readPublicFormAnswers(dto.publicAnswers ?? {});
    if (R.isFailure(publicAnswers)) {
      throw new BadRequestException(
        "Draft public answers are not a map of booleans",
      );
    }

    const fieldIds = this.draftableFieldIds(formSchemaOf(snapshot));
    const storedAnswers = pickKeys(answers.value, fieldIds.answered);
    const storedPublicAnswers = pickKeys(publicAnswers.value, fieldIds.output);
    const size = Buffer.byteLength(
      JSON.stringify([storedAnswers, storedPublicAnswers]),
    );
    if (size > FORM_DRAFT_MAX_ANSWER_BYTES) {
      throw new BadRequestException(
        `Draft answers are ${size} bytes, over the ${FORM_DRAFT_MAX_ANSWER_BYTES} byte limit`,
      );
    }

    const draft = {
      userId,
      formId,
      actionId: dto.actionId,
      formSnapshotId: snapshot.id,
      answers: storedAnswers,
      publicAnswers: storedPublicAnswers,
      currentPageIndex: dto.currentPageIndex ?? 0,
      updatedAt: new Date(),
    };
    await writeUnderLive(this.formResponseDraftRepository.manager, {
      parents: [
        { target: Action, id: dto.actionId },
        { target: Form, id: formId },
        { target: User, id: userId },
      ],
      write: (manager) =>
        manager.getRepository(FormResponseDraft).upsert(draft, {
          conflictPaths: ["userId", "formId"],
          indexPredicate: '"deletedAt" IS NULL',
        }),
    });
    return draft;
  }

  async getFormDraft(
    userId: number,
    formId: number,
  ): Promise<ParsedFormResponseDraft | null> {
    const draft = await this.formResponseDraftRepository.findOne({
      where: { userId, formId },
    });
    return draft && parseFormResponseDraft(draft);
  }

  async deleteFormDraft(userId: number, formId: number): Promise<void> {
    await softDeleteWhere(this.formResponseDraftRepository.manager, {
      target: FormResponseDraft,
      where: { userId, formId },
    });
  }

  /**
   * Ids a draft may carry, and the subset whose answers a member can publish.
   * A field the schema no longer has is dropped rather than rejected, so a
   * client still on the old schema keeps autosaving instead of 400ing.
   */
  private draftableFieldIds(schema: FormSchema): {
    answered: Set<string>;
    output: Set<string>;
  } {
    const answered = new Set<string>();
    const output = new Set<string>();
    for (const page of schema.pages ?? []) {
      for (const element of page.fields ?? []) {
        if (!isQuestionField(element)) {
          continue;
        }
        answered.add(element.id);
        if (element.output?.output) {
          output.add(element.id);
        }
      }
    }
    return { answered, output };
  }
}
