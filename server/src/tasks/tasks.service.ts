/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  ActionActivityType,
  FORM_ALREADY_SUBMITTED,
  withdrawalHasRequiredReason,
} from "@alliance/common/actionActivity";
import { isFollowUpFormActive } from "@alliance/common/followUpForm";
import type { DeviceVisibilityTarget } from "@alliance/common/forms/device";
import {
  FORM_DRAFT_MAX_ANSWER_BYTES,
  type FormAnswers,
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
import { type FormulaChoices } from "@alliance/common/forms/formula-choices";
import type { AssignedRow } from "@alliance/common/forms/row-list-schema";
import {
  stripHiddenAnswers,
  type VisibilityValidatorResults,
  visibilityValidatorResultsSchema,
} from "@alliance/common/forms/visibility";
import { R, type Result } from "@alliance/common/result";
import { describeSchemaIssues, issuePath } from "@alliance/common/zod-issues";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionActivityService } from "src/actions/action-activity.service";
import { ActionFormLinksService } from "src/actions/action-form-links.service";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { Action, parseAction } from "src/actions/entities/action.entity";
import {
  FollowUpForm,
  parseFollowUpForm,
} from "src/actions/entities/follow-up-form.entity";
import { PrerequisiteProgressService } from "src/actions/prerequisite-progress.service";
import { SingleMemberCohortService } from "src/actions/single-member-cohort.service";
import { assertNotInStaffPreview } from "src/actions/staff-preview";
import { AiDetectionQueueService } from "src/ai-detection/ai-detection-queue.service";
import { DetectableEntity } from "src/ai-detection/entities/ai-detection-result.entity";
import { Guest } from "src/auth/entities/guest.entity";
import { ContractService } from "src/contract/contract.service";
import { ContractDto } from "src/contract/dto/contract.dto";
import {
  softDeleteCascade,
  softDeleteWhere,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { In, type Repository } from "typeorm";
import { Form, loadedFormSnapshot } from "./entities/form.entity";
import {
  FormResponse,
  loadedFormResponseSnapshot,
  type ParsedFormResponse,
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
import { FormProfileAnswersService } from "./form-profile-answers.service";
import { FormResponseQueryService } from "./form-response-query.service";
import { FormRowAssignmentService } from "./form-row-assignment.service";
import {
  cloneFormSnapshotWithSchema,
  formSchemaOf,
  snapshotForRow,
} from "./form-snapshot-schema";
import {
  FormSubmissionValidationService,
  parseSubmittedAnswers,
  readListAnswer,
} from "./form-submission-validation.service";
import {
  CreateFormDto,
  type FormDraft,
  type FormSnapshotMigration,
  type FormSummary,
  SaveFormDraftDto,
  type SnapshotResponseGroup,
  SubmitFollowUpFormDto,
  SubmitFormDto,
  UpdateFormDto,
} from "./form.dto";
import { FormSnapshotService } from "./formsnapshot.service";
import {
  findFormsReadingForm,
  loadFormulaSourceForms,
} from "./formula-source-forms";
import {
  checkedFormulaChoices,
  guestFormulaSources,
  withdrawalFormulaSources,
  withdrawnFormulaChoices,
} from "./formula-sources";
import { servedSchema } from "./served-schema";

/**
 * Validator verdicts arrive from HTTP as arbitrary JSON — class-validator
 * can't express the id-keyed record, so parse before anything reaches the db.
 */
function parseSubmittedValidatorResults(
  value: unknown,
): VisibilityValidatorResults {
  const parsed = visibilityValidatorResultsSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(
      `Invalid visibility validator results: ${describeSchemaIssues(parsed.error).join("; ")}`,
    );
  }
  return parsed.data;
}

function assertListAnswersAreLists(
  schema: FormSchema,
  answers: FormAnswers,
): void {
  for (const page of schema.pages) {
    for (const field of page.fields) {
      if (field.kind === "list") {
        readListAnswer(field, answers[field.id]);
      }
    }
  }
}

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
    private readonly formResponseQueryService: FormResponseQueryService,
    private readonly formSubmissionValidationService: FormSubmissionValidationService,
    private readonly formProfileAnswersService: FormProfileAnswersService,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    @InjectRepository(FormResponseDraft)
    private formResponseDraftRepository: Repository<FormResponseDraft>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(FollowUpForm)
    private followUpFormRepository: TypedRepository<FollowUpForm>,
    private userService: UserService,
    private readonly actionActivityService: ActionActivityService,
    private readonly formLinks: ActionFormLinksService,
    private contractService: ContractService,
    private aiDetectionQueueService: AiDetectionQueueService,
    private formSnapshotService: FormSnapshotService,
    private actionFormVariantService: ActionFormVariantService,
    private singleMemberCohortService: SingleMemberCohortService,
    private prerequisiteProgressService: PrerequisiteProgressService,
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

  async submitForm(
    formId: number,
    userId: number,
    submitFormDto: SubmitFormDto,
  ): Promise<ParsedFormResponse> {
    const form = await this.getForm(formId);
    const user = await this.userService.findOneOrFail(userId, {
      optInMms: true,
    });

    const valid = await this.actionFormVariantService.validateFormIdForUser({
      actionId: submitFormDto.actionId,
      userId,
      formId,
    });
    if (!valid) {
      throw new ForbiddenException(
        "This form is not the variant assigned to you for this action",
      );
    }

    const action = await this.actionRepository.findOne({
      where: { id: submitFormDto.actionId },
      relations: { events: true },
    });
    if (action) {
      assertNotInStaffPreview(action);
    }
    await this.assertActionNotSubmitted({
      actionId: submitFormDto.actionId,
      userId,
    });

    // One instant for both completion checks, so a deadline passing
    // mid-submission cannot reject the completion after the answers applied.
    const submittedAt = new Date();
    if (action) {
      // Before any answer side effects (contract signing, profile updates).
      await this.actionActivityService.ensureCompletionAllowed({
        action: parseAction(action),
        userId,
        now: submittedAt,
      });
    }

    const assignedRow = await this.formRowAssignmentService.memberRow(
      form,
      userId,
    );
    const submittedSnapshot = snapshotForRow(
      await this.formSnapshotService.resolveSubmissionSnapshot({
        form,
        dto: submitFormDto,
        assignedRow,
      }),
      assignedRow,
    );
    const submittedSchema = formSchemaOf(submittedSnapshot);

    const { validatorResults, effectiveAnswers, formulaChoices } =
      await this.formSubmissionValidationService.validateFormSubmission({
        schema: submittedSchema,
        submitFormDto,
        userId,
      });

    await this.formProfileAnswersService.applyProfileAnswers({
      user,
      schema: submittedSchema,
      answers: effectiveAnswers,
    });

    const contractIdsSigned = this.getContractIdsSigned(
      submittedSchema,
      effectiveAnswers,
    );
    for (const contractId of contractIdsSigned) {
      await this.contractService.signContract({
        userId: user.id,
        signedName: null,
        contractId,
        viaTaskForm: true,
      });
    }

    const savedForm = await this.createAndSaveFormResponse({
      form,
      formId,
      dto: { ...submitFormDto, answers: effectiveAnswers },
      snapshot: submittedSnapshot,
      validatorResults,
      formulaChoices,
      assignedRow,
      user,
    });

    await this.actionActivityService.completeAction(
      submitFormDto.actionId,
      userId,
      {
        taskFormResponse: savedForm,
        now: submittedAt,
      },
    );
    if (contractIdsSigned.length > 0) {
      this.contractService.announceSigned(user.id);
    }
    await this.deleteFormDraft(userId, formId);

    return savedForm;
  }

  /** Submit a follow-up form response. Multiple submissions per user are allowed (no unique check). */
  async submitFollowUpForm(
    followUpFormId: number,
    userId: number,
    submitFollowUpFormDto: SubmitFollowUpFormDto,
  ): Promise<ParsedFormResponse> {
    const fetchedFollowUpForm = await this.followUpFormRepository.findOne({
      where: { id: followUpFormId },
    });
    const completions = fetchedFollowUpForm
      ? await this.prerequisiteProgressService.loadCompletions({
          actionId: fetchedFollowUpForm.actionId,
          userId,
        })
      : [];
    if (!fetchedFollowUpForm || completions.length === 0) {
      throw new NotFoundException("Follow-up form not found");
    }
    const form = await this.getForm(fetchedFollowUpForm.formId);
    const followUpForm = parseFollowUpForm(fetchedFollowUpForm);
    if (!isFollowUpFormActive(followUpForm)) {
      throw new BadRequestException("Follow-up form is not active");
    }
    const inCohort =
      !!followUpForm.cohortExpression &&
      (await this.singleMemberCohortService.computeIsInCohortExpression({
        user: await this.userService.findOneOrFail(userId, {
          tags: true,
          contractEvents: true,
          awayRanges: true,
        }),
        cohortExpression: followUpForm.cohortExpression,
      }));
    if (!inCohort) {
      throw new ForbiddenException(
        "User is not in the target cohort for this follow-up form",
      );
    }
    const user = await this.userService.findOneOrFail(userId);

    const assignedRow = await this.formRowAssignmentService.memberRow(
      form,
      userId,
    );
    const submittedSnapshot = snapshotForRow(
      await this.formSnapshotService.resolveSubmissionSnapshot({
        form,
        dto: submitFollowUpFormDto,
        assignedRow,
      }),
      assignedRow,
    );
    const { validatorResults, effectiveAnswers, formulaChoices } =
      await this.formSubmissionValidationService.validateFormSubmission({
        schema: formSchemaOf(submittedSnapshot),
        submitFormDto: submitFollowUpFormDto as SubmitFormDto,
        userId,
      });

    const savedForm = await this.createAndSaveFormResponse({
      form,
      formId: form.id,
      dto: { ...submitFollowUpFormDto, answers: effectiveAnswers },
      snapshot: submittedSnapshot,
      validatorResults,
      formulaChoices,
      assignedRow,
      user,
    });

    await this.actionActivityService.createActionActivity({
      actionId: followUpForm.actionId,
      userId,
      type: ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM,
      taskFormResponse: savedForm,
    });

    return savedForm;
  }

  async submitFormPublic({
    formId,
    submitFormDto,
    guestId,
  }: {
    formId: number;
    submitFormDto: SubmitFormDto;
    guestId?: string;
  }): Promise<ParsedFormResponse> {
    const form = await this.getForm(formId);
    if (formSchemaOf(loadedFormSnapshot(form)).rowList !== undefined) {
      throw new ForbiddenException("Sign in to submit this form");
    }

    if (guestId) {
      const existing = await this.formResponseRepository.findOne({
        where: { formId, guest: { id: guestId } },
      });
      if (existing) {
        throw new BadRequestException(FORM_ALREADY_SUBMITTED);
      }
    }

    const snapshot = await this.formSnapshotService.resolveSubmissionSnapshot({
      form,
      dto: submitFormDto,
      assignedRow: null,
    });
    const schema = formSchemaOf(snapshot);
    const validatorResults = parseSubmittedValidatorResults(
      submitFormDto.visibilityValidatorResults ?? {},
    );
    const answers = stripHiddenAnswers(
      schema.pages,
      parseSubmittedAnswers(submitFormDto.answers),
      {
        deviceType: submitFormDto.deviceType,
        visibilityValidatorResults: validatorResults,
      },
    );
    return this.createAndSaveFormResponse({
      form,
      formId,
      dto: submitFormDto,
      snapshot,
      validatorResults,
      formulaChoices: await checkedFormulaChoices({
        schema,
        answers,
        loadSources: async () => guestFormulaSources(schema),
      }),
      assignedRow: null,
      guestId,
    });
  }

  async optoutForm(
    formId: number,
    actionId: number,
    userId: number,
    withdrawal: { reason: string; outOfTime: boolean; isMoral: boolean },
    partialFormData: SubmitFormDto,
  ) {
    if (!withdrawalHasRequiredReason(withdrawal)) {
      throw new BadRequestException("A withdrawal reason is required");
    }
    const form = await this.getForm(formId);
    const user = await this.userService.findOneOrFail(userId);
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      relations: { events: true },
    });
    if (action) {
      assertNotInStaffPreview(action);
    }

    const assignedRow = await this.formRowAssignmentService.memberRow(
      form,
      userId,
    );
    const snapshot = snapshotForRow(
      await this.formSnapshotService.resolveSubmissionSnapshot({
        form,
        dto: partialFormData,
        assignedRow,
      }),
      assignedRow,
    );
    const schema = formSchemaOf(snapshot);
    const savedForm = await this.createAndSaveFormResponse({
      form,
      formId,
      dto: partialFormData,
      snapshot,
      validatorResults: parseSubmittedValidatorResults(
        partialFormData.visibilityValidatorResults ?? {},
      ),
      formulaChoices: await withdrawnFormulaChoices({
        schema,
        answers: parseSubmittedAnswers(partialFormData.answers),
        loadSources: () =>
          withdrawalFormulaSources({
            schema,
            sent: partialFormData.formulaSources,
            loadHistory:
              this.formResponseQueryService.formulaSourceHistoryLoader(userId),
          }),
      }),
      assignedRow,
      user,
    });

    await this.deleteFormDraft(userId, formId);

    return this.actionActivityService.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_WONT_COMPLETE,
      taskFormResponse: savedForm,
      declineReason: withdrawal.reason,
      isOutOfTime: withdrawal.outOfTime,
      isMoral: withdrawal.isMoral,
    });
  }

  private async assertActionNotSubmitted(params: {
    actionId: number;
    userId: number;
  }): Promise<void> {
    const submitted = await this.actionFormVariantService.findSubmittedFormIds({
      actionIds: [params.actionId],
      userId: params.userId,
    });
    if (submitted.has(params.actionId)) {
      throw new BadRequestException(FORM_ALREADY_SUBMITTED);
    }
  }

  private async createAndSaveFormResponse({
    form,
    formId,
    dto,
    snapshot,
    validatorResults,
    formulaChoices,
    assignedRow,
    user,
    guestId,
  }: {
    form: Form;
    formId: number;
    dto: {
      answers: Record<string, unknown>;
      deviceType: DeviceVisibilityTarget;
      publicAnswers?: Record<string, boolean>;
      phDistinctId?: string;
      sessionReplayUrl?: string;
      sid?: string;
    };
    snapshot: FormSnapshot;
    /**
     * The verdicts to store. A path that runs the validators itself passes
     * its own; only one that can't — a guest submission, an opt-out draft —
     * falls back to the blob the client sent.
     */
    validatorResults: VisibilityValidatorResults;
    formulaChoices: FormulaChoices;
    assignedRow: AssignedRow | null;
    user?: User;
    guestId?: string;
  }): Promise<ParsedFormResponse> {
    const answers = parseSubmittedAnswers(dto.answers);
    assertListAnswersAreLists(formSchemaOf(snapshot), answers);
    const formResponse = this.formResponseRepository.create({
      answers,
      formSnapshotId: snapshot.id,
      formSnapshot: snapshot,
      visibilityValidatorResults: validatorResults,
      formulaChoices,
      assignedRow,
      deviceType: dto.deviceType,
      publicAnswers: dto.publicAnswers ?? {},
      phDistinctId: dto.phDistinctId,
      sessionReplayUrl: dto.sessionReplayUrl,
      sid: dto.sid,
      form,
      formId,
      user,
      guest: guestId ? { id: guestId } : undefined,
    });
    const saved = await writeUnderLive(this.formResponseRepository.manager, {
      parents: [
        { target: Form, id: formId },
        ...(user ? [{ target: User, id: user.id }] : []),
        ...(guestId ? [{ target: Guest, id: guestId }] : []),
      ],
      write: (manager) => manager.save(formResponse),
    });
    const savedForm: ParsedFormResponse = Object.assign(saved, {
      visibilityValidatorResults: validatorResults,
      formulaChoices,
      assignedRow,
    });
    await this.aiDetectionQueueService.addDetectJob({
      entityType: DetectableEntity.FormResponse,
      entityId: savedForm.id,
    });
    return savedForm;
  }

  private getContractIdsSigned(
    schema: FormSchema,
    answers: Record<string, unknown>,
  ): number[] {
    const ids: number[] = [];

    for (const page of schema.pages ?? []) {
      if (!page.fields) {
        continue;
      }
      for (const field of page.fields) {
        if (
          (field as { kind?: string }).kind === "contract" &&
          (field as { contractId?: number }).contractId &&
          answers[(field as { id: string }).id] === true
        ) {
          ids.push((field as { contractId: number }).contractId);
        }
      }
    }

    return ids;
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
   * {@link submitForm} does around the save: required-field validation,
   * hidden-answer stripping, profile auto-extraction, contract signing, AI
   * detection, and the completion activity.
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

    await this.assertActionNotSubmitted({ actionId: dto.actionId, userId });

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
