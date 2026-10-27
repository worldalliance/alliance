import {
  ActionActivityType,
  FORM_ALREADY_SUBMITTED,
  withdrawalHasRequiredReason,
} from "@alliance/common/actionActivity";
import { isFollowUpFormActive } from "@alliance/common/followUpForm";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  stripHiddenAnswers,
  type VisibilityValidatorResults,
  visibilityValidatorResultsSchema,
} from "@alliance/common/forms/visibility";
import { describeSchemaIssues } from "@alliance/common/zod-issues";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionActivityService } from "src/actions/action-activity.service";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { Action, parseAction } from "src/actions/entities/action.entity";
import {
  FollowUpForm,
  parseFollowUpForm,
} from "src/actions/entities/follow-up-form.entity";
import { PrerequisiteProgressService } from "src/actions/prerequisite-progress.service";
import { SingleMemberCohortService } from "src/actions/single-member-cohort.service";
import { assertNotInStaffPreview } from "src/actions/staff-preview";
import { ContractService } from "src/contract/contract.service";
import { UserService } from "src/user/user.service";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { type Repository } from "typeorm";
import { assertActionNotSubmitted } from "./assert-action-not-submitted";
import { loadedFormSnapshot } from "./entities/form.entity";
import {
  FormResponse,
  type ParsedFormResponse,
} from "./entities/formresponse.entity";
import { FormDraftService } from "./form-draft.service";
import { FormProfileAnswersService } from "./form-profile-answers.service";
import { FormResponseQueryService } from "./form-response-query.service";
import { FormResponseWriterService } from "./form-response-writer.service";
import { FormRowAssignmentService } from "./form-row-assignment.service";
import { formSchemaOf, snapshotForRow } from "./form-snapshot-schema";
import {
  FormSubmissionValidationService,
  parseSubmittedAnswers,
} from "./form-submission-validation.service";
import { SubmitFollowUpFormDto, SubmitFormDto } from "./form.dto";
import { FormSnapshotService } from "./formsnapshot.service";
import {
  checkedFormulaChoices,
  guestFormulaSources,
  withdrawalFormulaSources,
  withdrawnFormulaChoices,
} from "./formula-sources";
import { TasksService } from "./tasks.service";

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

@Injectable()
export class FormSubmissionService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly formResponseWriterService: FormResponseWriterService,
    private readonly formDraftService: FormDraftService,
    private readonly formRowAssignmentService: FormRowAssignmentService,
    private readonly formProfileAnswersService: FormProfileAnswersService,
    private readonly formSubmissionValidationService: FormSubmissionValidationService,
    private readonly formResponseQueryService: FormResponseQueryService,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(FollowUpForm)
    private followUpFormRepository: TypedRepository<FollowUpForm>,
    private userService: UserService,
    private readonly actionActivityService: ActionActivityService,
    private contractService: ContractService,
    private formSnapshotService: FormSnapshotService,
    private actionFormVariantService: ActionFormVariantService,
    private singleMemberCohortService: SingleMemberCohortService,
    private prerequisiteProgressService: PrerequisiteProgressService,
  ) {}

  async submitForm(
    formId: number,
    userId: number,
    submitFormDto: SubmitFormDto,
  ): Promise<ParsedFormResponse> {
    const form = await this.tasksService.getForm(formId);
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
    await assertActionNotSubmitted(this.actionFormVariantService, {
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

    const savedForm =
      await this.formResponseWriterService.createAndSaveFormResponse({
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
    await this.formDraftService.deleteFormDraft(userId, formId);

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
    const form = await this.tasksService.getForm(fetchedFollowUpForm.formId);
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

    const savedForm =
      await this.formResponseWriterService.createAndSaveFormResponse({
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
    const form = await this.tasksService.getForm(formId);
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
    return this.formResponseWriterService.createAndSaveFormResponse({
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
    const form = await this.tasksService.getForm(formId);
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
    const savedForm =
      await this.formResponseWriterService.createAndSaveFormResponse({
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
                this.formResponseQueryService.formulaSourceHistoryLoader(
                  userId,
                ),
            }),
        }),
        assignedRow,
        user,
      });

    await this.formDraftService.deleteFormDraft(userId, formId);

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
}
