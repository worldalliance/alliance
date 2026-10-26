/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  FORM_DRAFT_MAX_ANSWER_BYTES,
  readFormAnswers,
  readPublicFormAnswers,
} from "@alliance/common/forms/form-responses";
import {
  type AggregateViewSchema,
  type AggregateViewValue,
  formSchema,
  FormSchema,
  type FormValue,
  isQuestionField,
} from "@alliance/common/forms/form-schema";
import {
  type FormSchemaValidationError,
  validateFormSchema,
} from "@alliance/common/forms/form-schema-validate";
import { R, type Result } from "@alliance/common/result";
import { issuePath } from "@alliance/common/zod-issues";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionFormLinksService } from "src/actions/action-form-links.service";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { Action } from "src/actions/entities/action.entity";
import { ContractService } from "src/contract/contract.service";
import { ContractDto } from "src/contract/dto/contract.dto";
import {
  softDeleteCascade,
  softDeleteWhere,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import { In, type Repository } from "typeorm";
import { assertActionNotSubmitted } from "./assert-action-not-submitted";
import { Form, loadedFormSnapshot } from "./entities/form.entity";
import {
  FormResponse,
  loadedFormResponseSnapshot,
} from "./entities/formresponse.entity";
import {
  FormResponseDraft,
  type ParsedFormResponseDraft,
  parseFormResponseDraft,
} from "./entities/formresponsedraft.entity";
import {
  FormSnapshot,
  SnapshotHistoryOwner,
} from "./entities/formsnapshot.entity";
import { FormRowAssignmentService } from "./form-row-assignment.service";
import {
  cloneFormSnapshotWithSchema,
  formSchemaOf,
  snapshotForRow,
} from "./form-snapshot-schema";
import {
  CreateFormDto,
  type FormDraft,
  type FormSnapshotMigration,
  type FormSummary,
  SaveFormDraftDto,
  type SnapshotResponseGroup,
  UpdateFormDto,
} from "./form.dto";
import { FormSnapshotService } from "./formsnapshot.service";
import {
  findFormsReadingForm,
  loadFormulaSourceForms,
} from "./formula-source-forms";
import { servedSchema } from "./served-schema";

function pickKeys<T>(
  values: Record<string, T>,
  allowed: Set<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => allowed.has(key)),
  );
}

const STORED_PAGES = `snapshot.schema -> 'pages'`;

// Both counts read this rather than the stored value, so a snapshot whose
// `pages` is not an array counts as empty instead of failing the query for
// every other form in the index. `pagesType` tells the two apart afterwards.
const READABLE_PAGES = `CASE WHEN jsonb_typeof(${STORED_PAGES}) = 'array' THEN ${STORED_PAGES} ELSE '[]'::jsonb END`;

const FIELD_COUNT = `(
  SELECT COALESCE(SUM(
    CASE WHEN jsonb_typeof(page -> 'fields') = 'array'
         THEN jsonb_array_length(page -> 'fields') ELSE 0 END
  ), 0)::int
  FROM jsonb_array_elements(${READABLE_PAGES}) AS page
)`;

type FormIndexRow = {
  id: number;
  title: string;
  formSnapshotId: number;
  pagesType: string | null;
  pageCount: number;
  fieldCount: number;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly formRowAssignmentService: FormRowAssignmentService,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    @InjectRepository(FormResponseDraft)
    private formResponseDraftRepository: Repository<FormResponseDraft>,
    private readonly formLinks: ActionFormLinksService,
    private contractService: ContractService,
    private formSnapshotService: FormSnapshotService,
    private actionFormVariantService: ActionFormVariantService,
  ) {}

  async createForm(createFormDto: CreateFormDto): Promise<Form> {
    const schema = await this.parseSchemaOrThrow(
      createFormDto.schema,
      undefined,
    );
    const snapshot = await this.formSnapshotService.findOrCreate(schema);
    const form = await this.formRepository.save({
      title: createFormDto.title,
      formSnapshotId: snapshot.id,
      formSnapshot: snapshot,
    });
    await this.formSnapshotService.recordHistorical({
      owner: SnapshotHistoryOwner.Form,
      ownerId: form.id,
      snapshotId: snapshot.id,
    });
    return form;
  }

  private async validateSchema(
    schema: unknown,
    formId: number | undefined,
  ): Promise<Result<FormSchema, FormSchemaValidationError[]>> {
    const parsed = formSchema.safeParse(schema);
    if (!parsed.success) {
      return R.failure(
        parsed.error.issues.map((issue) => ({
          blockId: issuePath(issue),
          message: issue.message,
        })),
      );
    }
    const errors = validateFormSchema(parsed.data, {
      formId,
      sourceForms: await loadFormulaSourceForms({
        formRepository: this.formRepository,
        schema: parsed.data,
      }),
    });
    if (errors.length > 0) {
      return R.failure(errors);
    }
    return R.success(parsed.data);
  }

  private async parseSchemaOrThrow(
    schema: unknown,
    formId: number | undefined,
  ): Promise<FormSchema> {
    const validated = await this.validateSchema(schema, formId);
    if (!validated.ok) {
      throw new BadRequestException({
        message: "Invalid form schema",
        errors: validated.error,
      });
    }
    return validated.value;
  }

  async getForm(formId: number): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: { formSnapshot: true },
    });
    if (!form) {
      throw new NotFoundException("Form not found");
    }

    return this.transformImageUrls(await this.transformContractFields(form));
  }

  /**
   * The form as `userId` is served it: for a form with a row list, filled from
   * their row, which is assigned on their first fetch. Members only.
   */
  async getMemberForm(formId: number, userId: number | null): Promise<Form> {
    const form = await this.getForm(formId);
    if (formSchemaOf(loadedFormSnapshot(form)).rowList === undefined) {
      return form;
    }
    if (userId === null) {
      throw new ForbiddenException("Sign in to open this form");
    }
    const row = await this.formRowAssignmentService.memberRow(form, userId);
    form.formSnapshot = snapshotForRow(loadedFormSnapshot(form), row);
    return form;
  }

  private resolveAggregateValue(
    value: AggregateViewValue,
    totalsByFieldId: Map<string, number>,
  ): number {
    if (value.type === "number") {
      return value.value;
    }
    return totalsByFieldId.get(value.fieldId) ?? 0;
  }

  async findFormAggregateViews(formId: number): Promise<AggregateViewSchema[]> {
    const form = await this.formRepository.findOneOrFail({
      where: { id: formId },
      relations: { formSnapshot: true },
    });

    const aggregateViews =
      formSchemaOf(loadedFormSnapshot(form)).aggregateViews ?? [];
    if (aggregateViews.length === 0) {
      return [];
    }

    const responses = await this.formResponseRepository.find({
      where: { formId },
      select: ["answers"],
    });

    const totalsByFieldId = new Map<string, number>();
    for (const response of responses) {
      const answers = (response.answers ?? {}) as Record<string, FormValue>;
      for (const [fieldId, answer] of Object.entries(answers)) {
        if (typeof answer === "number" && Number.isFinite(answer)) {
          totalsByFieldId.set(
            fieldId,
            (totalsByFieldId.get(fieldId) ?? 0) + answer,
          );
        }
      }
    }

    return aggregateViews.map((view) => ({
      ...view,
      numerator: {
        ...view.numerator,
        value: this.resolveAggregateValue(view.numerator, totalsByFieldId),
      },
      denominator: {
        ...view.denominator,
        value: this.resolveAggregateValue(view.denominator, totalsByFieldId),
      },
    }));
  }

  async transformImageUrls(form: Form): Promise<Form> {
    const snapshot = loadedFormSnapshot(form);
    form.formSnapshot = cloneFormSnapshotWithSchema(
      snapshot,
      servedSchema(snapshot),
    );
    return form;
  }

  async transformContractFields(form: Form): Promise<Form> {
    const snapshot = loadedFormSnapshot(form);
    const schema = structuredClone(formSchemaOf(snapshot));
    const pages = schema.pages;
    for (const page of pages) {
      for (const field of page.fields) {
        if (field.kind === "contract" && field.contractId) {
          field.contract = new ContractDto(
            await this.contractService.findOne(field.contractId),
          );
        }
      }
    }
    form.formSnapshot = cloneFormSnapshotWithSchema(snapshot, schema);
    return form;
  }

  async updateForm(
    formId: number,
    updateFormDto: UpdateFormDto,
  ): Promise<Form> {
    const form = await this.getForm(formId);

    const nextTitle =
      updateFormDto.title !== undefined ? updateFormDto.title : form.title;

    let nextSnapshotId = form.formSnapshotId;
    let snapshotChanged = false;
    if (updateFormDto.schema) {
      const schema = await this.parseSchemaOrThrow(
        updateFormDto.schema,
        formId,
      );
      this.stripContractFromSchema(schema);
      const snapshot = await this.formSnapshotService.findOrCreate(schema);
      if (snapshot.id !== form.formSnapshotId) {
        nextSnapshotId = snapshot.id;
        snapshotChanged = true;
      }
    }

    // Conditional UPDATE rejects stale saves atomically, and its row lock
    // holds off a deletion until the history row is in.
    const expected = updateFormDto.expectedFormSnapshotId;
    await this.formRepository.manager.transaction(async (em) => {
      const result = await em
        .createQueryBuilder()
        .update(Form)
        .set({ title: nextTitle, formSnapshotId: nextSnapshotId })
        .where("id = :formId", { formId })
        .andWhere('"deletedAt" IS NULL')
        .andWhere(
          expected === undefined ? "1 = 1" : '"formSnapshotId" = :expected',
          expected === undefined ? {} : { expected },
        )
        .execute();

      if (result.affected === 0) {
        if (!(await em.exists(Form, { where: { id: formId } }))) {
          throw new NotFoundException("Form not found");
        }
        throw new ConflictException(
          "This form was changed by someone else since you opened it.",
        );
      }

      if (snapshotChanged) {
        await this.formSnapshotService.recordHistorical({
          owner: SnapshotHistoryOwner.Form,
          ownerId: formId,
          snapshotId: nextSnapshotId,
          em,
        });
      }
    });

    return this.getForm(formId);
  }

  private stripContractFromSchema(schema: FormSchema): void {
    for (const page of schema.pages ?? []) {
      for (const field of page.fields) {
        if (
          typeof field === "object" &&
          field !== null &&
          "kind" in field &&
          (field as { kind?: string }).kind === "contract" &&
          "contract" in field
        ) {
          delete (field as { contract?: unknown }).contract;
        }
      }
    }
  }

  async listForms(): Promise<FormSummary[]> {
    const rows = await this.formRepository
      .createQueryBuilder("form")
      .innerJoin(FormSnapshot, "snapshot", "snapshot.id = form.formSnapshotId")
      .select("form.id", "id")
      .addSelect("form.title", "title")
      .addSelect("form.formSnapshotId", "formSnapshotId")
      .addSelect(`jsonb_typeof(${STORED_PAGES})`, "pagesType")
      .addSelect(`jsonb_array_length(${READABLE_PAGES})`, "pageCount")
      .addSelect(FIELD_COUNT, "fieldCount")
      .orderBy("form.id", "DESC")
      .getRawMany<FormIndexRow>();
    const actionsByFormId = await this.formLinks.findActionsByFormIds(
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      formSnapshotId: row.formSnapshotId,
      // Counted leniently: a form the strict schema rejects still shows its
      // size in the index, and a snapshot too malformed to read at all keeps
      // its row without counts.
      schemaCounts:
        row.pagesType === "array"
          ? { pages: row.pageCount, fields: row.fieldCount }
          : undefined,
      usedInAction: actionsByFormId.get(row.id),
    }));
  }

  async deleteForm(formId: number): Promise<void> {
    const form = await this.getForm(formId);
    const readers = await findFormsReadingForm({
      formRepository: this.formRepository,
      formId,
    });
    if (readers.length > 0) {
      const names = readers
        .map((reader) => `"${reader.title || "Untitled"}" (#${reader.id})`)
        .join(", ");
      throw new ConflictException(
        `Variables or options formulas in ${names} read this form's answers. Change them to stop reading it, then delete it`,
      );
    }
    await softDeleteCascade(this.formRepository.manager, {
      target: Form,
      ids: [form.id],
    });
  }

  async getResponseSnapshotMigration(
    formId: number,
  ): Promise<FormSnapshotMigration> {
    const form = await this.getForm(formId);
    const responses = await this.formResponseRepository.find({
      where: { formId },
      relations: { formSnapshot: true, user: true },
      order: { createdAt: "ASC" },
    });

    const groupsBySnapshotId = new Map<number, SnapshotResponseGroup>();
    for (const response of responses) {
      if (response.formSnapshotId === form.formSnapshotId) {
        continue;
      }
      const existing = groupsBySnapshotId.get(response.formSnapshotId);
      if (existing) {
        existing.responses.push(response);
      } else {
        groupsBySnapshotId.set(response.formSnapshotId, {
          snapshot: loadedFormResponseSnapshot(response),
          responses: [response],
        });
      }
    }

    const groups = Array.from(groupsBySnapshotId.values()).sort(
      (a, b) => a.snapshot.createdAt.getTime() - b.snapshot.createdAt.getTime(),
    );

    return { form, groups };
  }

  async migrateResponseSnapshots(
    formId: number,
    responseIds: number[],
    targetSnapshotId: number,
  ): Promise<number> {
    const form = await this.getForm(formId);
    if (form.formSnapshotId !== targetSnapshotId) {
      throw new ConflictException(
        "Form snapshot has changed since you loaded this page; refresh and re-review.",
      );
    }
    const matching = await this.formResponseRepository.find({
      select: { id: true },
      where: { formId, id: In(responseIds) },
    });
    if (matching.length !== responseIds.length) {
      const matchingIds = new Set(matching.map((r) => r.id));
      const unknownIds = responseIds.filter((id) => !matchingIds.has(id));
      throw new BadRequestException(
        `Response ids do not belong to form ${formId}: ${unknownIds.join(", ")}`,
      );
    }
    const result = await this.formResponseRepository
      .createQueryBuilder()
      .update(FormResponse)
      .set({ formSnapshotId: targetSnapshotId })
      .where("formId = :formId", { formId })
      .andWhere("id IN (:...responseIds)", { responseIds })
      .execute();
    return result.affected ?? 0;
  }

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
    const form = await this.getForm(formId);

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
