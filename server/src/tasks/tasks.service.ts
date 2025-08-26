import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import { CreateFormDto, FormDto, SubmitFormDto } from './form.dto';
import { FormSchema } from './schema';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    private userService: UserService,
  ) {}

  async createForm(createFormDto: CreateFormDto): Promise<Form> {
    return this.formRepository.save(createFormDto);
  }

  async getForm(formId: number): Promise<Form> {
    const form = await this.formRepository.findOne({ where: { id: formId } });
    if (!form) {
      throw new NotFoundException('Form not found');
    }
    return form;
  }

  async updateForm(
    formId: number,
    updateFormDto: CreateFormDto,
  ): Promise<Form> {
    const form = await this.getForm(formId);
    Object.assign(form, updateFormDto);
    return this.formRepository.save(form);
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

    const phoneNumber = await this.extractPhoneNumber(
      form,
      submitFormDto.answers,
    );
    if (phoneNumber) {
      //TODO: non hacky version of this
      user.phoneNumber = phoneNumber;
      await this.userService.update(user.id, user);
    }

    const formResponse = this.formResponseRepository.create({
      ...submitFormDto,
      form,
      formId,
      user,
    });

    return this.formResponseRepository.save(formResponse);
  }

  async extractPhoneNumber(
    form: Form,
    answers: Record<string, string>,
  ): Promise<string | null> {
    const schema = form.schema as unknown as FormSchema<string, string>;

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
    return forms.map(
      (form) =>
        ({
          id: form.id,
          title: form.title,
          schema: form.schema,
        }) satisfies FormDto,
    );
  }

  async deleteForm(formId: number): Promise<void> {
    const form = await this.getForm(formId);
    await this.formRepository.remove(form);
  }
}
