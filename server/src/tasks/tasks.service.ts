import { Temporal } from '@js-temporal/polyfill';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { parsePhoneNumber } from 'libphonenumber-js/max';
import { AiDetectionQueryService } from 'src/ai-detection/ai-detection-query.service';
import { AiDetectionQueueService } from 'src/ai-detection/ai-detection-queue.service';
import { DetectableEntity } from 'src/ai-detection/entities/ai-detection-result.entity';
import { ActionsService } from 'src/actions/actions.service';
import { ActionActivityType } from 'src/actions/entities/action-activity.entity';
import { Action } from 'src/actions/entities/action.entity';
import { FollowUpForm } from 'src/actions/entities/follow-up-form.entity';
import { ForumService } from 'src/forum/forum.service';
import { getImageSource } from 'src/images/images.service';
import { getVideoSource } from 'src/videos/videos.service';
import { MmsService } from 'src/mms/mms.service';
import { welcomeMessage } from 'src/notifs/textnotifcontents';
import { UserService } from 'src/user/user.service';
import { IsNull, type Repository } from 'typeorm';
import {
  CustomValidatorDto,
  CustomValidatorResponseDto,
  CustomValidatorTypeDto,
  TestCustomExpressionResponseDto,
} from './customvalidator.dto';
import {
  CustomValidator,
  CustomValidatorType,
  typeName,
  typeUsableForVisibility,
  typeUsesIdArgument,
} from './entities/customvalidator.entity';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import {
  CreateFormDto,
  FormDto,
  FormResponseDto,
  SubmitFollowUpFormDto,
  SubmitFormDto,
} from './form.dto';
import {
  type AnyField,
  type CheckboxExtractionTarget,
  type CheckboxField,
  type CityFieldValue,
  type CustomComponentField,
  type FormValue,
  FormSchema,
  isQuestionField,
  isQuestionVisible,
  type ListField,
  Page,
} from './schema';
import type { DeviceVisibilityTarget } from './schema';
import { ActionDto } from 'src/actions/dto/action.dto';
import { ActionShareUrl } from 'src/actions/entities/action-share-url.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { UpdateProfileDto } from 'src/user/dto/user.dto';
import { User } from 'src/user/entities/user.entity';
import { EventType } from 'src/eventlog/event-log.entity';
import { ContractService } from 'src/contract/contract.service';
import { ContractDto } from 'src/contract/dto/contract.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
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
    @InjectRepository(ActionShareUrl)
    private actionShareUrlRepository: Repository<ActionShareUrl>,
    private contractService: ContractService,
    private eventLogService: EventLogService,
    private aiDetectionQueueService: AiDetectionQueueService,
    private aiDetectionQueryService: AiDetectionQueryService,
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
    return this.formRepository.save(createFormDto);
  }

  async getForm(formId: number): Promise<Form> {
    const form = await this.formRepository.findOne({ where: { id: formId } });
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    return this.transformImageUrls(await this.transformContractFields(form));
  }

  async transformImageUrls(form: Form): Promise<Form> {
    const pages = form.schema.pages as Page[];
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
    return form;
  }

  async transformContractFields(form: Form): Promise<Form> {
    const pages = form.schema.pages as Page[];
    for (const page of pages) {
      for (const field of page.fields) {
        if (field.kind === 'contract' && field.contractId) {
          field.contract = new ContractDto(
            await this.contractService.findOne(field.contractId),
          );
        }
      }
    }
    return form;
  }

  async validateFormSubmission(
    form: Form,
    submitFormDto: SubmitFormDto,
    userId: number,
  ): Promise<Record<number, boolean>> {
    const schema = form.schema as unknown as FormSchema;
    const validatorIds = new Set<number>();

    for (const page of schema.pages) {
      for (const element of page.fields) {
        const conditions = Array.isArray(element.visibleIf)
          ? element.visibleIf
          : element.visibleIf
            ? [element.visibleIf]
            : [];
        for (const condition of conditions) {
          if ('validatorId' in condition) {
            validatorIds.add(condition.validatorId);
          }
        }
        const formula = element.visibleIfFormula;
        if (formula?.conditions) {
          for (const condition of Object.values(formula.conditions)) {
            if (
              condition &&
              'validatorId' in condition &&
              condition.validatorId != null
            ) {
              validatorIds.add(condition.validatorId);
            }
          }
        }
        if (isQuestionField(element) && element.kind === 'list') {
          const listField = element as ListField;
          if (Array.isArray(listField.fields)) {
            for (const sub of listField.fields) {
              const subConditions = Array.isArray(sub.visibleIf)
                ? sub.visibleIf
                : sub.visibleIf
                  ? [sub.visibleIf]
                  : [];
              for (const condition of subConditions) {
                if ('validatorId' in condition) {
                  validatorIds.add(condition.validatorId);
                }
              }
              const subFormula = sub.visibleIfFormula;
              if (subFormula?.conditions) {
                for (const condition of Object.values(subFormula.conditions)) {
                  if (
                    condition &&
                    'validatorId' in condition &&
                    condition.validatorId != null
                  ) {
                    validatorIds.add(condition.validatorId);
                  }
                }
              }
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

    for (const page of schema.pages) {
      for (const field of page.fields) {
        if (isQuestionField(field)) {
          if (
            field.required &&
            isQuestionVisible(
              field,
              submitFormDto.answers,
              validatorResults,
              submitFormDto.deviceType,
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
            isQuestionVisible(
              field,
              submitFormDto.answers,
              validatorResults,
              submitFormDto.deviceType,
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
              !isQuestionVisible(
                listField,
                submitFormDto.answers,
                validatorResults,
                submitFormDto.deviceType,
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
                  !isQuestionVisible(
                    sub,
                    mergedData,
                    validatorResults,
                    submitFormDto.deviceType,
                  )
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
    updateFormDto: CreateFormDto,
  ): Promise<Form> {
    const form = await this.getForm(formId);
    if (updateFormDto.schema) {
      this.stripContractFromSchema(
        updateFormDto.schema as unknown as FormSchema,
      );
    }
    Object.assign(form, updateFormDto);
    const saved = await this.formRepository.save(form);
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

    const existingFormResponse = await this.formResponseRepository.findOne({
      where: {
        formId,
        user: { id: userId },
      },
    });
    if (existingFormResponse) {
      throw new BadRequestException('Form already submitted');
    }

    const validatorResults = await this.validateFormSubmission(
      form,
      submitFormDto,
      userId,
    );

    const phoneNumber = this.getFirstAutoExtractAnswer(
      form,
      submitFormDto.answers,
      'phone',
    );
    const preferredReminderTime = this.getFirstAutoExtractAnswer(
      form,
      submitFormDto.answers,
      'time',
    );
    const timeZone = this.getFirstAutoExtractAnswer(
      form,
      submitFormDto.answers,
      'timezone',
    );

    const city = this.getFirstAutoExtractAnswer(
      form,
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
      form,
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
      form,
      submitFormDto.answers,
    );
    for (const contractId of contractIdsSigned) {
      await this.contractService.signContract({
        userId: user.id,
        signedName: undefined,
        contractId,
      });
    }

    const savedForm = await this.createAndSaveFormResponse(
      form,
      formId,
      submitFormDto,
      validatorResults,
      user,
    );

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
      where: { id: followUpFormId },
      relations: { form: true },
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
    const form = followUpForm.form;
    const user = await this.userService.findOneOrFail(userId);

    const validatorResults = await this.validateFormSubmission(
      form,
      submitFollowUpFormDto as SubmitFormDto,
      userId,
    );

    const savedForm = await this.createAndSaveFormResponse(
      form,
      form.id,
      submitFollowUpFormDto,
      validatorResults,
      user,
    );

    await this.actionsService.createActionActivity({
      actionId: followUpForm.actionId,
      userId,
      type: ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM,
      taskFormResponse: savedForm,
    });

    return savedForm;
  }

  async submitFormPublic(
    formId: number,
    submitFormDto: SubmitFormDto,
  ): Promise<FormResponse> {
    const form = await this.getForm(formId);

    return this.createAndSaveFormResponse(
      form,
      formId,
      submitFormDto,
      submitFormDto.visibilityValidatorResults ?? {},
      undefined,
    );
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

    const savedForm = await this.createAndSaveFormResponse(
      form,
      formId,
      partialFormData,
      partialFormData?.visibilityValidatorResults ?? {},
      user,
    );

    return this.actionsService.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_WONT_COMPLETE,
      taskFormResponse: savedForm,
      declineReason: reason,
      isOutOfTime: outOfTime,
    });
  }

  private async createAndSaveFormResponse(
    form: Form,
    formId: number,
    dto: {
      answers: Record<string, unknown>;
      schemaSnapshot: Record<string, unknown>;
      visibilityValidatorResults?: Record<string, boolean>;
      deviceType?: DeviceVisibilityTarget;
      publicAnswers?: Record<string, boolean>;
      phDistinctId?: string;
      sessionReplayUrl?: string;
      sid?: string;
    },
    validatorResults: Record<string, boolean>,
    user?: User,
  ): Promise<FormResponse> {
    const formResponse = this.formResponseRepository.create({
      answers: dto.answers,
      schemaSnapshot: dto.schemaSnapshot,
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
    });
    const savedForm = await this.formResponseRepository.save(formResponse);
    await this.aiDetectionQueueService.addDetectJob({
      entityType: DetectableEntity.FormResponse,
      entityId: savedForm.id,
    });
    return savedForm;
  }

  private getFirstAutoExtractAnswer(
    form: Form,
    answers: Record<string, unknown>,
    kind: 'phone' | 'time' | 'timezone' | 'city',
  ): string | null {
    const schema = form.schema as unknown as FormSchema;

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
    form: Form,
    answers: Record<string, unknown>,
  ): number[] {
    const schema = form.schema as unknown as FormSchema;
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
    form: Form,
    answers: Record<string, unknown>,
    target: CheckboxExtractionTarget,
  ): boolean | null {
    const schema = form.schema as unknown as FormSchema;

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
    const forms = await this.formRepository.find();
    return Promise.all(
      forms.map(async (form) => {
        const action = await this.actionRepository.findOne({
          where: { taskFormId: form.id },
        });
        return {
          id: form.id,
          title: form.title,
          schema: form.schema,
          usedInAction: action ? new ActionDto(action) : undefined,
        } satisfies FormDto;
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
      relations: { user: true },
    });
    if (!responses.length) {
      return responses;
    }

    const aiDetectionByResponseId =
      await this.aiDetectionQueryService.findForEntities(
        DetectableEntity.FormResponse,
        responses.map((response) => response.id),
      );

    return responses.map((response) => ({
      ...response,
      aiDetectionResults: aiDetectionByResponseId.get(response.id) ?? [],
    }));
  }

  async getMyFormResponse(
    userId: number,
    formId: number,
  ): Promise<FormResponseDto> {
    const responses = await this.formResponseRepository.find({
      where: { formId, user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
    if (!responses.length) {
      throw new NotFoundException('Form response not found');
    }
    return responses[0];
  }

  async customValidators(): Promise<CustomValidatorTypeDto[]> {
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

  async findOneCustomValidator(id: number): Promise<CustomValidatorDto> {
    return this.customValidatorRepository.findOneOrFail({ where: { id } });
  }

  async testCustomExpression(
    expression: string,
    userId?: number,
  ): Promise<TestCustomExpressionResponseDto> {
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
    const passUsers: {
      id: number;
      name: string;
      anonymous: boolean;
      hasActiveContract: boolean;
    }[] = [];
    const failUsers: {
      id: number;
      name: string;
      anonymous: boolean;
      hasActiveContract: boolean;
    }[] = [];
    const toSummary = (user: User) => ({
      id: user.id,
      name: user.name,
      anonymous: user.anonymous,
      hasActiveContract: user.hasActiveContract,
    });
    for (const user of users) {
      const isValid = runForUser(user);
      if (isValid) {
        passCount += 1;
        passUsers.push(toSummary(user));
      } else {
        failCount += 1;
        failUsers.push(toSummary(user));
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
  ): Promise<CustomValidatorResponseDto> {
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

  async getFormsForUserSID(userId: number): Promise<FormResponseDto[]> {
    const shareUrl = await this.actionShareUrlRepository.findOne({
      where: {
        user: { id: userId },
      },
    });
    if (!shareUrl) {
      return [];
    }

    const sid: string | null =
      shareUrl.sid ?? (shareUrl.data?.['sid'] as string) ?? null;

    if (!sid) {
      return [];
    }

    const formResponses = await this.formResponseRepository.find({
      where: {
        sid,
      },
    });
    return formResponses;
  }
}
