import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { Action } from 'src/actions/entities/action.entity';
import { getImageSource } from 'src/images/images.service';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import {
  CreateFormDto,
  FormDto,
  FormResponseDto,
  SubmitFormDto,
} from './form.dto';
import { MailService } from 'src/mail/mail.service';
import { EmailType } from 'src/mail/mail.entity';
import { FormSchema, isQuestionField, isQuestionVisible, Page } from './schema';

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
    private mailService: MailService,
  ) {
    // this.sendTestEmail();
  }

  async sendTestEmail() {
    const form = await this.formRepository.findOne({ where: {} });
    if (!form) {
      throw new NotFoundException('Form not found');
    }
    await this.mailService.sendMailWithRenderedForm(
      'caseytmanning@gmail.com',
      EmailType.Other,
      'Test Email',
      {},
      form.schema as unknown as FormSchema,
    );
  }

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
  ): Promise<void> {
    const schema = form.schema as unknown as FormSchema;

    for (const page of schema.pages) {
      for (const field of page.fields) {
        if (isQuestionField(field)) {
          if (
            field.required &&
            isQuestionVisible(field, submitFormDto.answers)
          ) {
            if (!submitFormDto.answers[field.id]) {
              throw new BadRequestException(`Field ${field.label} is required`);
            }
          }
        }
      }
    }
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
    if (!form) {
      throw new NotFoundException('Form not found');
    }
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    console.log('submitFormDto', submitFormDto);

    await this.validateFormSubmission(form, submitFormDto);

    const phoneNumber = await this.extractPhoneNumber(
      form,
      submitFormDto.answers,
    );
    if (phoneNumber) {
      this.logger.log(`Extracted phone number: ${phoneNumber}`);
      const parsedNumber = parsePhoneNumberWithError(phoneNumber, 'US'); //TODO: check with non US numbers

      if (parsedNumber.isValid()) {
        this.logger.log(`Valid phone number: ${parsedNumber.number}`);
        user.phoneNumberValidated = true;
        user.phoneNumber = parsedNumber.number;
      } else {
        this.logger.warn(`Parsed an invalid phone number: ${phoneNumber}`);
        user.phoneNumber = phoneNumber;
      }
    }
    await this.userService.update(user.id, user);

    const formResponse = this.formResponseRepository.create({
      ...submitFormDto,
      form,
      formId,
      schemaSnapshot: submitFormDto.schemaSnapshot,
      user,
    });

    return this.formResponseRepository.save(formResponse);
  }

  async extractPhoneNumber(
    form: Form,
    answers: Record<string, string>,
  ): Promise<string | null> {
    const schema = form.schema as unknown as FormSchema;

    const phoneNumbers: { fieldId: string; label: string; value: string }[] =
      [];

    for (const page of schema.pages) {
      if (page.fields) {
        for (const field of page.fields) {
          if (field.kind === 'phone' && answers[field.id]) {
            phoneNumbers.push({
              fieldId: field.id,
              label: field.label,
              value: answers[field.id],
            });
          }
        }
      }
    }

    if (phoneNumbers.length > 0) {
      console.log(`📞 Phone numbers submitted for form "${form.title}":`);
      phoneNumbers.forEach((phone) => {
        console.log(` - ${phone.label}: ${phone.value}`);
      });
      return phoneNumbers[0].value;
    }
    return null;
  }

  async listForms(): Promise<FormDto[]> {
    const forms = await this.formRepository.find();
    return Promise.all(
      forms.map(
        async (form) =>
          ({
            id: form.id,
            title: form.title,
            schema: form.schema,
            usedInAction: (
              await this.actionRepository.findOne({
                where: { taskFormId: form.id },
              })
            )?.name,
          }) satisfies FormDto,
      ),
    );
  }

  async deleteForm(formId: number): Promise<void> {
    const form = await this.getForm(formId);
    await this.formRepository.remove(form);
  }

  async getFormResponses(formId: number): Promise<FormResponseDto[]> {
    const responses = await this.formResponseRepository.find({
      where: { formId },
      relations: ['user'],
    });
    return responses;
  }

  async getMyFormResponse(
    userId: number,
    formId: number,
  ): Promise<FormResponseDto> {
    const response = await this.formResponseRepository.findOne({
      where: { formId, user: { id: userId } },
    });
    if (!response) {
      throw new NotFoundException('Form response not found');
    }
    return response;
  }
}
