import type { DeviceVisibilityTarget } from '@alliance/common/forms/device';
import {
  type AggregateViewSchema,
  type AggregateViewValue,
  type AnyField,
  type CheckboxExtractionTarget,
  type CheckboxField,
  type CityFieldValue,
  collectSourceFormIds,
  type CustomComponentField,
  FormSchema,
  type FormValue,
  isQuestionField,
  type ListField,
  Page,
} from '@alliance/common/forms/form-schema';
import { validateFormSchema } from '@alliance/common/forms/form-schema-validate';
import {
  type ConditionExtras,
  isElementCurrentlyVisible,
} from '@alliance/common/forms/visibility';
import type { Condition } from '@alliance/common/forms/visible-if-formula';
import { Temporal } from '@js-temporal/polyfill';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { parsePhoneNumber } from 'libphonenumber-js/max';
import { ActionFormVariantService } from 'src/actions/action-form-variant.service';
import { ActionsService } from 'src/actions/actions.service';
import { ActionDto } from 'src/actions/dto/action.dto';
import { ActionActivityType } from 'src/actions/entities/action-activity.entity';
import { Action } from 'src/actions/entities/action.entity';
import { FollowUpForm } from 'src/actions/entities/follow-up-form.entity';
import { AiDetectionQueryService } from 'src/ai-detection/ai-detection-query.service';
import { AiDetectionQueueService } from 'src/ai-detection/ai-detection-queue.service';
import { DetectableEntity } from 'src/ai-detection/entities/ai-detection-result.entity';
import { ContractService } from 'src/contract/contract.service';
import { ContractDto } from 'src/contract/dto/contract.dto';
import { EventType } from 'src/eventlog/event-log.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { ForumService } from 'src/forum/forum.service';
import { getImageSource } from 'src/images/images.service';
import { MmsService } from 'src/mms/mms.service';
import { welcomeMessage } from 'src/notifs/textnotifcontents';
import { ShareUrlsService } from 'src/share-urls/share-urls.service';
import { UpdateProfileDto } from 'src/user/dto/user.dto';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { getVideoSource } from 'src/videos/videos.service';
import { In, IsNull, type Repository } from 'typeorm';
import {
  CustomValidatorResponse,
  CustomValidatorTypeDtoArgs,
  TestCustomExpressionResponse,
} from './customvalidator.dto';
import {
  CustomValidator,
  CustomValidatorType,
  typeName,
  typeUsableForVisibility,
  typeUsesIdArgument,
} from './entities/customvalidator.entity';
import { FormResponseVersion } from './entities/form-response-version.entity';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import { FormSnapshot } from './entities/formsnapshot.entity';
import {
  CreateFormDto,
  EditFormResponseDto,
  FormDto,
  FormResponseDto,
  FormResponseVersionDto,
  type FormSnapshotMigration,
  type SnapshotResponseGroup,
  SubmitFollowUpFormDto,
  SubmitFormDto,
  UpdateFormDto,
} from './form.dto';
import { FormSnapshotService } from './formsnapshot.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    @InjectRepository(FormResponseVersion)
    private formResponseVersionRepository: Repository<FormResponseVersion>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(FollowUpForm)
    private followUpFormRepository: Repository<FollowUpForm>,
    private userService: UserService,
    private forumService: ForumService,
    private actionsService: ActionsService,
    private mmsService: MmsService,
    @InjectRepository(CustomValidator)
    private customValidatorRepository: Repository<CustomValidator>,
    private shareUrlsService: ShareUrlsService,
    private contractService: ContractService,
    private eventLogService: EventLogService,
    private aiDetectionQueueService: AiDetectionQueueService,
    private aiDetectionQueryService: AiDetectionQueryService,
    private formSnapshotService: FormSnapshotService,
    private actionFormVariantService: ActionFormVariantService,
  ) {}

  /** Returns true if value satisfies required validation for the field. Used for both top-level and list sub-field validation. */
  private hasRequiredValue(field: AnyField, value: unknown): boolean {
    if (field.kind === 'contract') {
      return value !== undefined;
    }
    if (value === undefined || value === null) {
      return false;
    }
    if (field.kind === 'number' || field.kind === 'range') {
      return typeof value === 'number' && Number.isFinite(value);
    }
    if (field.kind === 'checkbox') {
      return value === true;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return true;
  }

  async createForm(createFormDto: CreateFormDto): Promise<Form> {
    this.assertSchemaValid(createFormDto.schema as unknown as FormSchema);
    const snapshot = await this.formSnapshotService.findOrCreate(
      createFormDto.schema,
    );
    const form = await this.formRepository.save({
      title: createFormDto.title,
      formSnapshotId: snapshot.id,
      formSnapshot: snapshot,
    });
    await this.formSnapshotService.recordHistorical(form.id, snapshot.id);
    return form;
  }

  private assertSchemaValid(schema: FormSchema): void {
    const errors = validateFormSchema(schema);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Invalid form schema',
        errors,
      });
    }
  }

  async getForm(formId: number): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: { formSnapshot: true },
    });
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    return this.transformImageUrls(await this.transformContractFields(form));
  }

  private resolveAggregateValue(
    value: AggregateViewValue,
    totalsByFieldId: Map<string, number>,
  ): number {
    if (value.type === 'number') {
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
      (form.formSnapshot.schema as unknown as FormSchema).aggregateViews ?? [];
    if (aggregateViews.length === 0) {
      return [];
    }

    const responses = await this.formResponseRepository.find({
      where: { formId },
      select: ['answers'],
    });

    const totalsByFieldId = new Map<string, number>();
    for (const response of responses) {
      const answers = (response.answers ?? {}) as Record<string, FormValue>;
      for (const [fieldId, answer] of Object.entries(answers)) {
        if (typeof answer === 'number' && Number.isFinite(answer)) {
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

  private cloneFormSnapshotWithSchema(
    snapshot: FormSnapshot,
    schema: Record<string, unknown>,
  ): FormSnapshot {
    return Object.assign(new FormSnapshot(), snapshot, { schema });
  }

  async transformImageUrls(form: Form): Promise<Form> {
    const schema = structuredClone(form.formSnapshot.schema);
    const pages = schema.pages as Page[];
    for (const page of pages) {
      for (const field of page.fields) {
        if (field.kind === 'image') {
          field.src = getImageSource(field.src);
        }
        if (field.kind === 'video') {
          field.src = getVideoSource(field.src);
        }
      }
    }
    form.formSnapshot = this.cloneFormSnapshotWithSchema(
      form.formSnapshot,
      schema,
    );
    return form;
  }

  async transformContractFields(form: Form): Promise<Form> {
    const schema = structuredClone(form.formSnapshot.schema);
    const pages = schema.pages as Page[];
    for (const page of pages) {
      for (const field of page.fields) {
        if (field.kind === 'contract' && field.contractId) {
          field.contract = new ContractDto(
            await this.contractService.findOne(field.contractId),
          );
        }
      }
    }
    form.formSnapshot = this.cloneFormSnapshotWithSchema(
      form.formSnapshot,
      schema,
    );
    return form;
  }

  async validateFormSubmission({
    schema,
    submitFormDto,
    userId,
  }: {
    // The schema the user submitted against
    schema: FormSchema;
    submitFormDto: SubmitFormDto;
    userId: number;
  }): Promise<Record<number, boolean>> {
    const validatorIds = new Set<number>();
    let hasUserHasCityCondition = false;

    const collectFromFormula = (formula?: { conditions?: unknown }): void => {
      const conditions = formula?.conditions;
      if (!conditions || typeof conditions !== 'object') {
        return;
      }
      for (const condition of Object.values(
        conditions as Record<string, Condition>,
      )) {
        if (!condition) continue;
        if (condition.kind === 'validator') {
          validatorIds.add(condition.validatorId);
        } else if (condition.kind === 'userHasCity') {
          hasUserHasCityCondition = true;
        }
      }
    };

    for (const page of schema.pages) {
      for (const element of page.fields) {
        collectFromFormula(element.visibleIfFormula);
        if (isQuestionField(element) && element.kind === 'list') {
          const listField = element as ListField;
          if (Array.isArray(listField.fields)) {
            for (const sub of listField.fields) {
              collectFromFormula(sub.visibleIfFormula);
            }
          }
        }
      }
    }

    const validatorResults: Record<number, boolean> = {};
    if (validatorIds.size > 0) {
      const results = await Promise.all(
        Array.from(validatorIds).map(async (validatorId) => {
          try {
            const result = await this.runValidator(validatorId, userId);
            return [validatorId, result.isValid] as const;
          } catch (error) {
            this.logger.error(
              `Failed to evaluate visibility validator ${validatorId}: ${String(error)}`,
            );
            return [validatorId, false] as const;
          }
        }),
      );
      for (const [id, value] of results) {
        validatorResults[id] = value;
      }
    }

    // Fetch previous form responses for cross-form visibility conditions
    const sourceFormIds = collectSourceFormIds(schema);
    const previousAnswerData: Record<number, Record<string, unknown>> = {};
    if (sourceFormIds.length > 0) {
      const entries = await Promise.all(
        sourceFormIds.map(async (formId) => {
          try {
            const response = await this.formResponseRepository.findOne({
              where: { formId, user: { id: userId } },
              order: { createdAt: 'DESC' },
            });
            if (response?.answers) {
              return [formId, response.answers] as const;
            }
          } catch {
            // form response not found
          }
          return null;
        }),
      );
      for (const entry of entries) {
        if (entry) previousAnswerData[entry[0]] = entry[1];
      }
    }
    const userHasCity = hasUserHasCityCondition
      ? await this.userService.userHasCitySet(userId)
      : false;

    const visibilityExtras: ConditionExtras = {
      deviceType: submitFormDto.deviceType,
      visibilityValidatorResults: validatorResults,
      previousAnswerData:
        Object.keys(previousAnswerData).length > 0
          ? previousAnswerData
          : undefined,
      userHasCity,
    };

    for (const page of schema.pages) {
      for (const field of page.fields) {
        if (isQuestionField(field)) {
          if (
            field.required &&
            isElementCurrentlyVisible(
              field,
              submitFormDto.answers,
              visibilityExtras,
            )
          ) {
            if (
              !this.hasRequiredValue(field, submitFormDto.answers[field.id])
            ) {
              throw new BadRequestException(`Field ${field.label} is required`);
            }
          }
          if (
            field.kind === 'multiselect' &&
            typeof field.maxSelections === 'number' &&
            field.maxSelections > 0 &&
            isElementCurrentlyVisible(
              field,
              submitFormDto.answers,
              visibilityExtras,
            )
          ) {
            const answer = submitFormDto.answers[field.id];
            if (Array.isArray(answer) && answer.length > field.maxSelections) {
              throw new BadRequestException(
                `Field ${field.label} allows selecting up to ${field.maxSelections} options.`,
              );
            }
          }
          if (field.kind === 'list') {
            const listField = field as ListField;
            if (
              !isElementCurrentlyVisible(
                listField,
                submitFormDto.answers,
                visibilityExtras,
              )
            ) {
              continue;
            }
            const rawList = submitFormDto.answers[listField.id];
            const listValue: Record<string, FormValue>[] = Array.isArray(
              rawList,
            )
              ? (rawList as unknown[]).filter(
                  (item): item is Record<string, FormValue> =>
                    item !== null &&
                    typeof item === 'object' &&
                    !Array.isArray(item),
                )
              : [];
            const minCards = Math.max(
              0,
              Math.floor(Number(listField.min ?? 0)),
            );
            const maxCards =
              typeof listField.max === 'number' && listField.max >= 0
                ? Math.floor(listField.max)
                : Infinity;
            if (listField.required && listValue.length === 0) {
              throw new BadRequestException(
                `Field ${listField.label} requires at least one item.`,
              );
            }
            if (listValue.length < minCards) {
              throw new BadRequestException(
                `Field ${listField.label}: add at least ${minCards} item${minCards === 1 ? '' : 's'}.`,
              );
            }
            if (listValue.length > maxCards) {
              throw new BadRequestException(
                `Field ${listField.label}: add no more than ${maxCards} item${maxCards === 1 ? '' : 's'}.`,
              );
            }
            const subFields = listField.fields ?? [];
            for (let i = 0; i < listValue.length; i += 1) {
              const card = listValue[i] ?? {};
              const mergedData = {
                ...submitFormDto.answers,
                ...card,
              } as Record<string, FormValue>;
              for (const sub of subFields) {
                if (
                  !isQuestionField(sub) ||
                  !sub.required ||
                  !isElementCurrentlyVisible(sub, mergedData, visibilityExtras)
                ) {
                  continue;
                }
                const subValue = card[sub.id];
                if (!this.hasRequiredValue(sub, subValue)) {
                  throw new BadRequestException(
                    `Field ${listField.label} (item ${i + 1}): ${sub.label ?? sub.id} is required.`,
                  );
                }
              }
            }
          }
        }
      }
    }

    return validatorResults;
  }

  async updateForm(
    formId: number,
    updateFormDto: UpdateFormDto,
  ): Promise<Form> {
    const form = await this.getForm(formId);
    if (updateFormDto.title !== undefined) {
      form.title = updateFormDto.title;
    }
    if (updateFormDto.isEditable !== undefined) {
      form.isEditable = updateFormDto.isEditable;
    }
    if (updateFormDto.riskLevel !== undefined) {
      form.riskLevel = updateFormDto.riskLevel;
    }
    let snapshotChanged = false;
    if (updateFormDto.schema) {
      this.assertSchemaValid(updateFormDto.schema as unknown as FormSchema);
      this.stripContractFromSchema(
        updateFormDto.schema as unknown as FormSchema,
      );
      const snapshot = await this.formSnapshotService.findOrCreate(
        updateFormDto.schema,
      );
      if (snapshot.id !== form.formSnapshotId) {
        form.formSnapshotId = snapshot.id;
        form.formSnapshot = snapshot;
        snapshotChanged = true;
      }
    }
    const saved = await this.formRepository.save(form);
    if (snapshotChanged) {
      await this.formSnapshotService.recordHistorical(
        saved.id,
        saved.formSnapshotId,
      );
    }
    return this.transformImageUrls(await this.transformContractFields(saved));
  }

  private stripContractFromSchema(schema: FormSchema): void {
    for (const page of schema.pages ?? []) {
      for (const field of page.fields) {
        if (
          typeof field === 'object' &&
          field !== null &&
          'kind' in field &&
          (field as { kind?: string }).kind === 'contract' &&
          'contract' in field
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
  ): Promise<FormResponse> {
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
        'This form is not the variant assigned to you for this action',
      );
    }

    const action = await this.actionRepository.findOne({
      where: { id: submitFormDto.actionId },
    });
    const variants = await this.actionFormVariantService.listForAction(
      submitFormDto.actionId,
    );
    const actionFormIds = new Set<number>([formId]);
    if (action?.taskFormId != null) actionFormIds.add(action.taskFormId);
    for (const v of variants) actionFormIds.add(v.formId);

    const existingFormResponse = await this.formResponseRepository.findOne({
      where: {
        formId: In([...actionFormIds]),
        user: { id: userId },
      },
    });
    if (existingFormResponse) {
      throw new BadRequestException('Form already submitted');
    }

    const submittedSnapshot = await this.resolveSubmissionSnapshot(
      form,
      submitFormDto,
    );
    const submittedSchema = submittedSnapshot.schema as unknown as FormSchema;

    const validatorResults = await this.validateFormSubmission({
      schema: submittedSchema,
      submitFormDto,
      userId,
    });

    const phoneNumber = this.getFirstAutoExtractAnswer(
      submittedSchema,
      submitFormDto.answers,
      'phone',
    );
    const preferredReminderTime = this.getFirstAutoExtractAnswer(
      submittedSchema,
      submitFormDto.answers,
      'time',
    );
    const timeZone = this.getFirstAutoExtractAnswer(
      submittedSchema,
      submitFormDto.answers,
      'timezone',
    );

    const city = this.getFirstAutoExtractAnswer(
      submittedSchema,
      submitFormDto.answers,
      'city',
    );

    const userUpdates: Partial<UpdateProfileDto> = {};

    if (phoneNumber) {
      this.logger.log(`Extracted phone number: ${phoneNumber}`);
      try {
        const parsedNumber = parsePhoneNumberWithError(phoneNumber, 'US');

        if (parsedNumber.isValid()) {
          this.logger.log(`Valid phone number: ${parsedNumber.number}`);
          userUpdates.phoneNumber = parsedNumber.number;
          userUpdates.phoneNumberValidated = true;

          if (!user.optInMms) {
            const mms = await this.mmsService.sendMms(
              parsedNumber.number,
              welcomeMessage,
              [],
            );
            if (mms) {
              await this.userService.setOptInMms(user.id, mms.id);
            } else {
              if (process.env.NODE_ENV === 'production') {
                await this.eventLogService.sendMessage({
                  type: EventType.SmsFailure,
                  message: `Failed to send opt-in MMS to ${parsedNumber.number}`,
                  userId: user.id,
                  blob: { to: parsedNumber.number },
                });
              }
            }
          }
        } else {
          this.logger.warn(`Parsed an invalid phone number: ${phoneNumber}`);
          userUpdates.phoneNumber = phoneNumber;
        }
      } catch {
        this.logger.warn(`Failed to parse phone number: ${phoneNumber}`);
        userUpdates.phoneNumber = phoneNumber;
      }
    }

    if (city) {
      const parsedCityId = Number.parseInt(city, 10);
      if (Number.isFinite(parsedCityId)) {
        userUpdates.cityId = parsedCityId;
      } else {
        this.logger.warn(`setting custom city from form submission: ${city}`);
        userUpdates.customCityString = city;
      }
    }

    if (preferredReminderTime) {
      try {
        const parsedTime = Temporal.PlainTime.from(preferredReminderTime);
        userUpdates.preferredReminderTime = parsedTime;
      } catch {
        this.logger.warn(
          `Failed to parse preferred reminder time: ${preferredReminderTime}`,
        );
      }
    }

    function isTimeZoneValid(timeZoneIdentifier: string): boolean {
      try {
        Temporal.Now.instant().toZonedDateTimeISO(timeZoneIdentifier);
        return true;
      } catch (error) {
        if (error instanceof RangeError) {
          return false;
        }
        throw error;
      }
    }

    if (timeZone) {
      if (isTimeZoneValid(timeZone)) {
        userUpdates.timeZone = timeZone;
      } else {
        this.logger.warn(`Invalid time zone: ${timeZone}`);
      }
    }

    const shareInfoPublicly = this.getCheckboxExtractionValue(
      submittedSchema,
      submitFormDto.answers,
      'shareInfoPublicly',
    );
    if (shareInfoPublicly !== null) {
      userUpdates.shareInfoPublicly = shareInfoPublicly;
    }

    if (Object.keys(userUpdates).length > 0) {
      await this.userService.update(user.id, userUpdates);
    }

    const contractIdsSigned = this.getContractIdsSigned(
      submittedSchema,
      submitFormDto.answers,
    );
    for (const contractId of contractIdsSigned) {
      await this.contractService.signContract({
        userId: user.id,
        signedName: undefined,
        contractId,
      });
    }

    const savedForm = await this.createAndSaveFormResponse({
      form,
      formId,
      dto: submitFormDto,
      snapshot: submittedSnapshot,
      validatorResults,
      user,
    });

    await this.actionsService.completeAction(submitFormDto.actionId, userId, {
      taskFormResponse: savedForm,
    });

    return savedForm;
  }

  /** Submit a follow-up form response. Multiple submissions per user are allowed (no unique check). */
  async submitFollowUpForm(
    followUpFormId: number,
    userId: number,
    submitFollowUpFormDto: SubmitFollowUpFormDto,
  ): Promise<FormResponse> {
    const followUpForm = await this.followUpFormRepository.findOne({
      where: {
        id: followUpFormId,
        action: {
          activities: {
            type: ActionActivityType.USER_COMPLETED,
            user: { id: userId },
          },
        },
      },
      relations: {
        form: { formSnapshot: true },
      },
    });
    if (!followUpForm?.form) {
      throw new NotFoundException('Follow-up form not found');
    }
    if (
      !followUpForm.startDate ||
      (followUpForm.endDate && followUpForm.endDate < new Date())
    ) {
      throw new BadRequestException('Follow-up form is not active');
    }
    const inCohort =
      !!followUpForm.cohortExpression &&
      (await this.actionsService.computeIsInCohortExpression({
        user: await this.userService.findOneOrFail(userId, { tags: true }),
        cohortExpression: followUpForm.cohortExpression,
      }));
    if (!inCohort) {
      throw new ForbiddenException(
        'User is not in the target cohort for this follow-up form',
      );
    }
    const form = followUpForm.form;
    const user = await this.userService.findOneOrFail(userId);

    const submittedSnapshot = await this.resolveSubmissionSnapshot(
      form,
      submitFollowUpFormDto,
    );
    const validatorResults = await this.validateFormSubmission({
      schema: submittedSnapshot.schema as unknown as FormSchema,
      submitFormDto: submitFollowUpFormDto as SubmitFormDto,
      userId,
    });

    const savedForm = await this.createAndSaveFormResponse({
      form,
      formId: form.id,
      dto: submitFollowUpFormDto,
      snapshot: submittedSnapshot,
      validatorResults,
      user,
    });

    await this.actionsService.createActionActivity({
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
  }): Promise<FormResponse> {
    const form = await this.getForm(formId);

    if (guestId) {
      const existing = await this.formResponseRepository.findOne({
        where: { formId, guest: { id: guestId } },
      });
      if (existing) {
        throw new BadRequestException('Form already submitted');
      }
    }

    return this.createAndSaveFormResponse({
      form,
      formId,
      dto: submitFormDto,
      validatorResults: submitFormDto.visibilityValidatorResults ?? {},
      guestId,
    });
  }

  async optoutForm(
    formId: number,
    actionId: number,
    userId: number,
    reason: string,
    outOfTime: boolean,
    partialFormData: SubmitFormDto,
  ) {
    const form = await this.getForm(formId);
    const user = await this.userService.findOneOrFail(userId);

    const savedForm = await this.createAndSaveFormResponse({
      form,
      formId,
      dto: partialFormData,
      validatorResults: partialFormData?.visibilityValidatorResults ?? {},
      user,
    });

    return this.actionsService.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_WONT_COMPLETE,
      taskFormResponse: savedForm,
      declineReason: reason,
      isOutOfTime: outOfTime,
    });
  }

  private async createAndSaveFormResponse({
    form,
    formId,
    dto,
    snapshot: preResolvedSnapshot,
    validatorResults,
    user,
    guestId,
  }: {
    form: Form;
    formId: number;
    dto: {
      answers: Record<string, unknown>;
      // BACKCOMPAT(form-snapshot): change this from optional to required.
      formSnapshotId?: number;
      // BACKCOMPAT(form-snapshot): legacy payload from pre-cutover mobile
      // clients. Resolved to a snapshot row below. Remove once the floor
      // mobile version sends formSnapshotId.
      schemaSnapshot?: Record<string, unknown>;
      visibilityValidatorResults?: Record<string, boolean>;
      deviceType: DeviceVisibilityTarget;
      publicAnswers?: Record<string, boolean>;
      phDistinctId?: string;
      sessionReplayUrl?: string;
      sid?: string;
    };
    snapshot?: FormSnapshot;
    validatorResults: Record<string, boolean>;
    user?: User;
    guestId?: string;
  }): Promise<FormResponse> {
    const snapshot =
      preResolvedSnapshot ?? (await this.resolveSubmissionSnapshot(form, dto));
    const formResponse = this.formResponseRepository.create({
      answers: dto.answers,
      formSnapshotId: snapshot.id,
      formSnapshot: snapshot,
      visibilityValidatorResults:
        dto.visibilityValidatorResults ?? validatorResults,
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
    const savedForm = await this.formResponseRepository.save(formResponse);
    await this.aiDetectionQueueService.addDetectJob({
      entityType: DetectableEntity.FormResponse,
      entityId: savedForm.id,
    });
    return savedForm;
  }

  // BACKCOMPAT(form-snapshot): pre-cutover mobile clients post
  // `schemaSnapshot` (the full schema) instead of `formSnapshotId`. Resolve
  // it to a historical snapshot for this form by hash — never accept the
  // bytes as authoritative, since the resolved schema feeds validation,
  // contract-signing extraction, and auto-extract. Once the minimum mobile
  // version is past the cutover, delete this helper and inline the
  // formSnapshotId branch back into createAndSaveFormResponse.
  private async resolveSubmissionSnapshot(
    form: Form,
    dto: { formSnapshotId?: number; schemaSnapshot?: Record<string, unknown> },
  ) {
    if (dto.formSnapshotId !== undefined) {
      return dto.formSnapshotId === form.formSnapshotId && form.formSnapshot
        ? form.formSnapshot
        : this.formSnapshotService.findHistoricalOrThrow(
            form.id,
            dto.formSnapshotId,
          );
    }
    if (!dto.schemaSnapshot) {
      throw new BadRequestException(
        'Form submission missing both formSnapshotId and schemaSnapshot',
      );
    }
    return this.formSnapshotService.findHistoricalBySchemaOrThrow(
      form.id,
      dto.schemaSnapshot,
    );
  }

  private getFirstAutoExtractAnswer(
    schema: FormSchema,
    answers: Record<string, unknown>,
    kind: 'phone' | 'time' | 'timezone' | 'city',
  ): string | null {
    for (const page of schema.pages ?? []) {
      if (!page.fields) {
        continue;
      }
      for (const field of page.fields) {
        if (kind === 'city' && field.kind === 'city') {
          const answer = answers[field.id];
          if (
            answer &&
            typeof answer === 'object' &&
            'id' in (answer as CityFieldValue) &&
            typeof (answer as CityFieldValue).id === 'number' &&
            Number.isFinite((answer as CityFieldValue).id)
          ) {
            return (answer as CityFieldValue).id.toString();
          }
          return answer as string;
        }
        if (
          field.kind === kind &&
          field.autoExtractUserData &&
          typeof answers[field.id] === 'string'
        ) {
          const value = (answers[field.id] as string).trim();
          if (value) {
            return value;
          }
        }
      }
    }

    return null;
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
          (field as { kind?: string }).kind === 'contract' &&
          (field as { contractId?: number }).contractId &&
          answers[(field as { id: string }).id] === true
        ) {
          ids.push((field as { contractId: number }).contractId);
        }
      }
    }

    return ids;
  }

  private getCheckboxExtractionValue(
    schema: FormSchema,
    answers: Record<string, unknown>,
    target: CheckboxExtractionTarget,
  ): boolean | null {
    for (const page of schema.pages ?? []) {
      if (!page.fields) {
        continue;
      }
      for (const field of page.fields) {
        if (field.kind !== 'checkbox' && field.kind !== 'custom') {
          continue;
        }
        const extractField = field as CheckboxField | CustomComponentField;
        if (extractField.autoExtractUserData?.target !== target) {
          continue;
        }
        const answer = answers[field.id];
        if (typeof answer === 'boolean') {
          return answer;
        }
        if (typeof answer === 'string') {
          const normalized = answer.trim().toLowerCase();
          if (normalized === 'true') {
            return true;
          }
          if (normalized === 'false') {
            return false;
          }
        }
        // Field wasn't answered - don't overwrite existing user setting
        return null;
      }
    }

    return null;
  }

  async listForms(): Promise<FormDto[]> {
    const forms = await this.formRepository.find({
      relations: { formSnapshot: true },
    });
    return Promise.all(
      forms.map(async (form) => {
        const action = await this.actionsService.findActionByFormId(form.id);
        return new FormDto(form, action ? new ActionDto(action) : undefined);
      }),
    );
  }

  async deleteForm(formId: number): Promise<void> {
    const form = await this.getForm(formId);
    await this.formRepository.remove(form);
  }

  async getFormResponses(formId: number): Promise<FormResponseDto[]> {
    const responses = await this.formResponseRepository.find({
      where: { formId },
      relations: { user: true, formSnapshot: true },
    });
    if (!responses.length) {
      return [];
    }

    const aiDetectionByResponseId =
      await this.aiDetectionQueryService.findForEntities(
        DetectableEntity.FormResponse,
        responses.map((response) => response.id),
      );

    return responses.map(
      (response) =>
        new FormResponseDto({
          response,
          aiDetectionResults: aiDetectionByResponseId.get(response.id),
        }),
    );
  }

  async getResponseSnapshotMigration(
    formId: number,
  ): Promise<FormSnapshotMigration> {
    const form = await this.getForm(formId);
    const responses = await this.formResponseRepository.find({
      where: { formId },
      relations: { formSnapshot: true, user: true },
      order: { createdAt: 'ASC' },
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
          snapshot: response.formSnapshot,
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
        'Form snapshot has changed since you loaded this page; refresh and re-review.',
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
        `Response ids do not belong to form ${formId}: ${unknownIds.join(', ')}`,
      );
    }
    const result = await this.formResponseRepository
      .createQueryBuilder()
      .update(FormResponse)
      .set({ formSnapshotId: targetSnapshotId })
      .where('formId = :formId', { formId })
      .andWhere('id IN (:...responseIds)', { responseIds })
      .execute();
    return result.affected ?? 0;
  }

  async getMyFormResponse(
    userId: number,
    formId: number,
  ): Promise<FormResponse> {
    const response = await this.formResponseRepository.findOne({
      where: { formId, user: { id: userId } },
      relations: { formSnapshot: true, user: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    if (!response) {
      throw new NotFoundException('Form response not found');
    }
    return response;
  }

  async getGuestFormResponse(
    guestId: string,
    formId: number,
  ): Promise<FormResponse | null> {
    const response = await this.formResponseRepository.findOne({
      where: { formId, guest: { id: guestId, linkedUser: IsNull() } },
      relations: { formSnapshot: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return response;
  }

  async getLinkedGuestDraftFormResponse(
    userId: number,
    formId: number,
  ): Promise<FormResponse | null> {
    // If the user has already submitted this form as an authenticated user,
    // any linked-guest draft is stale and shouldn't be surfaced as a prefill.
    const userResponse = await this.formResponseRepository.findOne({
      where: { formId, user: { id: userId } },
    });
    if (userResponse) {
      return null;
    }
    const draft = await this.formResponseRepository.findOne({
      where: { formId, guest: { linkedUser: { id: userId } } },
      relations: { formSnapshot: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return draft;
  }

  async customValidators(): Promise<CustomValidatorTypeDtoArgs[]> {
    const types = Object.values(CustomValidatorType);
    return types.map((type) => ({
      name: typeName[type],
      id: type,
      withIdField: typeUsesIdArgument[type],
      usableForVisibility: typeUsableForVisibility[type],
    }));
  }

  async findOrCreateCustomValidator(
    type: CustomValidatorType,
    idArg?: string,
    expression?: string,
  ): Promise<CustomValidator> {
    let validator = await this.customValidatorRepository.findOne({
      where: {
        type,
        idArgument: idArg ?? IsNull(),
        expression: expression ?? IsNull(),
      },
    });
    if (!validator) {
      validator = this.customValidatorRepository.create({
        type,
        idArgument: idArg,
        expression: expression,
      });
      await this.customValidatorRepository.save(validator);
    }
    return validator;
  }

  async findOneCustomValidator(id: number): Promise<CustomValidator> {
    return this.customValidatorRepository.findOneOrFail({ where: { id } });
  }

  async testCustomExpression(
    expression: string,
    userId?: number,
  ): Promise<TestCustomExpressionResponse> {
    if (!expression?.trim()) {
      throw new BadRequestException('Expression is empty');
    }

    let expressionFn: (user: User) => unknown;
    try {
      expressionFn = eval(expression) as (user: User) => unknown;
    } catch (error) {
      throw new BadRequestException(
        `Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (typeof expressionFn !== 'function') {
      throw new BadRequestException('Expression must evaluate to a function');
    }

    const runForUser = (user: User): boolean => {
      let result: unknown;
      try {
        result = expressionFn(user);
      } catch (error) {
        throw new BadRequestException(
          `Expression failed for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (typeof result !== 'boolean') {
        throw new BadRequestException(
          `Expression must return a boolean (user ${user.id}).`,
        );
      }
      return result;
    };

    let selectedUserResult: boolean | undefined;
    if (typeof userId === 'number') {
      const selectedUser = await this.userService.findOneOrFail(userId, {
        tags: true,
        communities: true,
        contractEvents: true,
      });
      if (!selectedUser.hasActiveContract) {
        throw new BadRequestException(
          'Selected user does not have an active contract',
        );
      }
      selectedUserResult = runForUser(selectedUser);
    }

    const users = (
      await this.userService.findAll({
        tags: true,
        communities: true,
        contractEvents: true,
      })
    ).filter((user) => user.hasActiveContract);

    let passCount = 0;
    let failCount = 0;
    const passUsers: User[] = [];
    const failUsers: User[] = [];
    for (const user of users) {
      const isValid = runForUser(user);
      if (isValid) {
        passCount += 1;
        passUsers.push(user);
      } else {
        failCount += 1;
        failUsers.push(user);
      }
    }

    return {
      passCount,
      failCount,
      totalCount: users.length,
      passUsers,
      failUsers,
      selectedUserId: userId,
      selectedUserResult,
    };
  }

  async runValidator(
    id: number,
    userId: number,
    fieldValue?: string,
  ): Promise<CustomValidatorResponse> {
    const validator = await this.customValidatorRepository.findOneOrFail({
      where: { id },
    });
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      communities: true,
      contractEvents: true,
    });

    switch (validator.type) {
      case CustomValidatorType.UploadedPhoto:
        if (!user.profilePicture) {
          return {
            isValid: false,
            message: 'You have not uploaded a profile picture yet',
          };
        }
        break;
      case CustomValidatorType.SignedContract:
        if (!user.hasActiveContract) {
          return {
            isValid: false,
            message: 'You have not signed the contract yet',
          };
        }
        break;
      case CustomValidatorType.AddedProfileDescription:
        if (!user.profileDescription) {
          return {
            isValid: false,
            message: 'You have not added a profile description yet',
          };
        }
        break;
      case CustomValidatorType.RepliedToForumPost:
        if (!validator.idArgument) {
          throw new BadRequestException('Validator has no id argument');
        }
        const replies = await this.forumService.findCommentsForPost(
          Number(validator.idArgument),
        );
        if (
          replies.filter((reply) => reply.authorId === user.id).length === 0
        ) {
          return {
            isValid: false,
            message:
              'You have not replied to the discussion yet - please do that now.',
          };
        }
        break;
      case CustomValidatorType.RepliedToForumPostOrChild:
        if (!validator.idArgument) {
          throw new BadRequestException('Validator has no id argument');
        }
        const replies2 = await this.forumService.findCommentsForPostRaw(
          Number(validator.idArgument),
        );
        if (!replies2.some((reply) => reply.authorId === user.id)) {
          return {
            isValid: false,
            message:
              'You have not replied to the discussion yet - please do that now.',
          };
        }
        break;
      case CustomValidatorType.HasPhoneNumber:
        if (!user.phoneNumber) {
          //TODO: check for validation (but inform the user)
          return {
            isValid: false,
            message:
              'You have not added a phone number yet - please do that now.',
          };
        }
        break;
      case CustomValidatorType.IsPhoneNumberValid:
        if (!fieldValue) {
          return {
            isValid: false,
            message:
              'You have not entered a phone number yet - please do that now.',
          };
        }
        try {
          parsePhoneNumber(fieldValue, 'US');
          return { isValid: true };
        } catch (error) {
          console.log('Error parsing phone number: ', error);
          return {
            isValid: false,
            message: 'Could not validate phone number',
          };
        }
      case CustomValidatorType.MemberTag:
        if (!validator.idArgument) {
          throw new BadRequestException('Validator has no id argument');
        }
        if (user.tags.some((tag) => tag.id === validator.idArgument)) {
          return {
            isValid: true,
          };
        } else {
          return { isValid: false };
        }
      case CustomValidatorType.MemberCommunity:
        if (!validator.idArgument) {
          throw new BadRequestException('Validator has no id argument');
        }
        if (
          user.communities.some(
            (community) => community.id === Number(validator.idArgument),
          )
        ) {
          return { isValid: true };
        } else {
          return { isValid: false };
        }
      case CustomValidatorType.AnyCommunity:
        if (user.communities.length === 0) {
          return { isValid: false };
        }
        return { isValid: true };
      case CustomValidatorType.CustomExpression:
        if (!validator.expression) {
          throw new BadRequestException('Validator has no expression');
        }
        const expressionFn = eval(validator.expression) as (
          user: User,
        ) => unknown;
        return { isValid: expressionFn(user) as boolean };
      default:
        console.warn(
          `Unknown validator type: ${validator.type satisfies never}`,
        );
    }
    return { isValid: true };
  }

  async editFormResponse(
    userId: number,
    formId: number,
    dto: EditFormResponseDto,
  ): Promise<FormResponse> {
    const formResponse = await this.formResponseRepository.findOne({
      where: { formId, user: { id: userId } },
      relations: { formSnapshot: true, user: true },
    });

    this.logger.log(
      `[editFormResponse] user=${userId} form=${formId} attempt=${(formResponse?.editCount ?? 0) + 1}/3`,
    );

    if (!formResponse) {
      this.logger.error(`[editFormResponse] NOT FOUND user=${userId} form=${formId}`);
      throw new NotFoundException('Form response not found');
    }

    const form = await this.formRepository.findOne({ where: { id: formId } });
    if (!form?.isEditable) {
      this.logger.warn(
        `[editFormResponse] BLOCKED user=${userId} form=${formId} — form is not editable`,
      );
      throw new BadRequestException('This form does not allow editing');
    }

    if (formResponse.editCount >= 3) {
      this.logger.warn(
        `[editFormResponse] BLOCKED user=${userId} form=${formId} — edit limit reached (editCount=${formResponse.editCount})`,
      );
      throw new BadRequestException('Edit limit reached (3/3)');
    }

    await this.formResponseVersionRepository.save({
      formResponseId: formResponse.id,
      version: formResponse.editCount + 1,
      answers: formResponse.answers,
    });

    formResponse.answers = dto.answers;
    formResponse.editCount += 1;
    const saved = await this.formResponseRepository.save(formResponse);

    this.logger.log(
      `[editFormResponse] SUCCESS\n${JSON.stringify(
        {
          responseId: saved.id,
          version: saved.editCount,
          userId,
          formId,
          submittedAt: saved.createdAt,
          updatedAt: saved.updatedAt,
          answers: saved.answers,
        },
        null,
        2,
      )}`,
    );

    return saved;
  }

  async getResponseVersions(formId: number): Promise<FormResponseVersionDto[]> {
    const versions = await this.formResponseVersionRepository.find({
      where: { formResponse: { formId } },
      order: { createdAt: 'ASC' },
    });
    return versions.map((v) => new FormResponseVersionDto(v));
  }

  async getFormsForUserSID(userId: number): Promise<FormResponse[]> {
    const sids = await this.shareUrlsService.findActionShareSidsForUser(userId);
    if (sids.length === 0) {
      return [];
    }
    return this.formResponseRepository.find({
      where: { sid: In(sids) },
      relations: { formSnapshot: true },
    });
  }
}
