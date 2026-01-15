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
import { ActionsService } from 'src/actions/actions.service';
import { ActionActivityType } from 'src/actions/entities/action-activity.entity';
import { Action } from 'src/actions/entities/action.entity';
import { ForumService } from 'src/forum/forum.service';
import { getImageSource } from 'src/images/images.service';
import { MmsService } from 'src/mms/mms.service';
import { welcomeMessage } from 'src/notifs/textnotifcontents';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';
import {
  CustomValidatorDto,
  CustomValidatorResponseDto,
  CustomValidatorTypeDto,
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
  SubmitFormDto,
} from './form.dto';
import {
  CheckboxExtractionTarget,
  CheckboxField,
  CityFieldValue,
  CustomComponentField,
  FormSchema,
  isQuestionField,
  isQuestionVisible,
  Page,
} from './schema';
import { ActionDto } from 'src/actions/dto/action.dto';
import { City } from 'src/geo/city.entity';
import { ActionShareUrl } from 'src/actions/entities/action-share-url.entity';
import { SlackService } from 'src/slack/slack.service';

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
    private userService: UserService,
    private forumService: ForumService,
    private actionsService: ActionsService,
    private mmsService: MmsService,
    @InjectRepository(CustomValidator)
    private customValidatorRepository: Repository<CustomValidator>,
    @InjectRepository(ActionShareUrl)
    private actionShareUrlRepository: Repository<ActionShareUrl>,
    private slackService: SlackService,
  ) {}

  async createForm(createFormDto: CreateFormDto): Promise<Form> {
    return this.formRepository.save(createFormDto);
  }

  async getForm(formId: number): Promise<Form> {
    const form = await this.formRepository.findOne({ where: { id: formId } });
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    return this.transformImageUrls(form);
  }

  async transformImageUrls(form: Form): Promise<Form> {
    const pages = form.schema.pages as Page[];
    for (const page of pages) {
      for (const field of page.fields) {
        if (field.kind === 'image') {
          field.src = getImageSource(field.src);
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
              !submitFormDto.answers[field.id] &&
              !(
                (field.kind === 'number' || field.kind === 'range') &&
                submitFormDto.answers[field.id] === 0
              )
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
    Object.assign(form, updateFormDto);
    return this.transformImageUrls(await this.formRepository.save(form));
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

    let userNeedsUpdate = false;

    if (phoneNumber) {
      this.logger.log(`Extracted phone number: ${phoneNumber}`);
      const parsedNumber = parsePhoneNumberWithError(phoneNumber, 'US');

      if (parsedNumber.isValid()) {
        this.logger.log(`Valid phone number: ${parsedNumber.number}`);
        user.phoneNumberValidated = true;
        user.phoneNumber = parsedNumber.number;
        userNeedsUpdate = true;

        if (!user.optInMms) {
          const mms = await this.mmsService.sendMms(
            parsedNumber.number,
            welcomeMessage,
            [],
          );
          if (mms) {
            user.optInMms = mms;
            userNeedsUpdate = true;
          } else {
            if (process.env.NODE_ENV === 'production') {
              await this.slackService.sendMessage(
                `Failed to send opt-in MMS to ${parsedNumber.number}`,
              );
            }
          }
        }
      } else {
        this.logger.warn(`Parsed an invalid phone number: ${phoneNumber}`);
        user.phoneNumber = phoneNumber;
        userNeedsUpdate = true;
      }
    }

    if (city) {
      const parsedCityId = Number.parseInt(city, 10);
      if (Number.isFinite(parsedCityId)) {
        user.city = { id: parsedCityId } as City;
        userNeedsUpdate = true;
      } else {
        this.logger.warn(`setting custom city from form submission: ${city}`);
        user.customCityString = city;
        userNeedsUpdate = true;
      }
    }

    if (preferredReminderTime) {
      try {
        const parsedTime = Temporal.PlainTime.from(preferredReminderTime);
        user.preferredReminderTime = parsedTime;
        userNeedsUpdate = true;
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
        user.timeZone = timeZone;
        userNeedsUpdate = true;
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
      user.shareInfoPublicly = shareInfoPublicly;
      userNeedsUpdate = true;
    }

    if (userNeedsUpdate) {
      await this.userService.update(user.id, user);
    }

    const formResponse = this.formResponseRepository.create({
      ...submitFormDto,
      form,
      formId,
      schemaSnapshot: submitFormDto.schemaSnapshot,
      visibilityValidatorResults:
        submitFormDto.visibilityValidatorResults ?? validatorResults,
      deviceType: submitFormDto.deviceType,
      publicAnswers: submitFormDto.publicAnswers ?? {},
      user,
    });
    const savedForm = await this.formResponseRepository.save(formResponse);

    await this.actionsService.completeAction(
      submitFormDto.actionId,
      userId,
      savedForm,
    );

    return savedForm;
  }

  async submitFormPublic(
    formId: number,
    submitFormDto: SubmitFormDto,
  ): Promise<FormResponse> {
    const form = await this.getForm(formId);

    const formResponse = this.formResponseRepository.create({
      ...submitFormDto,
      form,
      formId,
      schemaSnapshot: submitFormDto.schemaSnapshot,
      visibilityValidatorResults: submitFormDto.visibilityValidatorResults,
      deviceType: submitFormDto.deviceType,
      publicAnswers: submitFormDto.publicAnswers ?? {},
    });
    const savedForm = await this.formResponseRepository.save(formResponse);

    return savedForm;
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

    const formResponse = this.formResponseRepository.create({
      ...partialFormData,
      form,
      formId,
      schemaSnapshot: partialFormData.schemaSnapshot,
      visibilityValidatorResults:
        partialFormData?.visibilityValidatorResults ?? {},
      deviceType: partialFormData.deviceType,
      publicAnswers: partialFormData.publicAnswers ?? {},
      user,
    });
    const savedForm = await this.formResponseRepository.save(formResponse);

    return this.actionsService.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_WONT_COMPLETE,
      taskFormResponse: savedForm,
      declineReason: reason,
      isOutOfTime: outOfTime,
    });
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
    return responses;
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
    idArg?: number,
  ): Promise<number> {
    let validator = await this.customValidatorRepository.findOne({
      where: { type, idArgument: idArg },
    });
    if (!validator) {
      validator = this.customValidatorRepository.create({
        type,
        idArgument: idArg,
      });
      await this.customValidatorRepository.save(validator);
    }
    return validator.id;
  }

  async findOneCustomValidator(id: number): Promise<CustomValidatorDto> {
    return this.customValidatorRepository.findOneOrFail({ where: { id } });
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
            message:
              'You have not uploaded a profile picture yet - please do that now',
          };
        }
        break;
      case CustomValidatorType.SignedContract:
        if (!user.hasActiveContract) {
          return {
            isValid: false,
            message:
              'You have not signed the contract yet - please do that now.',
          };
        }
        break;
      case CustomValidatorType.AddedProfileDescription:
        if (!user.profileDescription) {
          return {
            isValid: false,
            message:
              'You have not added a profile description yet - please do that now.',
          };
        }
        break;
      case CustomValidatorType.RepliedToForumPost:
        if (!validator.idArgument) {
          throw new BadRequestException('Validator has no id argument');
        }
        const replies = await this.forumService.findCommentsForPost(
          validator.idArgument,
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
            (community) => community.id === validator.idArgument,
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
