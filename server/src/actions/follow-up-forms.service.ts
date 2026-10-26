import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteCascade, writeUnderLive } from "src/datasources/soft-delete";
import { Form } from "src/tasks/entities/form.entity";
import { type Repository } from "typeorm";
import { ActionsService } from "./actions.service";
import { parseCohortExpressionForSaveOrThrow } from "./cohort-reference-validation";
import {
  CreateFollowUpFormDto,
  UpdateFollowUpFormDto,
} from "./dto/follow-up-form.dto";
import { Action } from "./entities/action.entity";
import {
  FollowUpForm,
  parseFollowUpForm,
  type ParsedFollowUpForm,
} from "./entities/follow-up-form.entity";

@Injectable()
export class FollowUpFormsService {
  constructor(
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(FollowUpForm)
    private readonly followUpFormRepository: Repository<FollowUpForm>,
    private readonly actionsService: ActionsService,
  ) {}

  async createFollowUpForm(
    actionId: number,
    dto: CreateFollowUpFormDto,
  ): Promise<ParsedFollowUpForm> {
    if (dto.cohortExpression != null) {
      dto.cohortExpression = await parseCohortExpressionForSaveOrThrow({
        em: this.followUpFormRepository.manager,
        value: dto.cohortExpression,
      });
    }
    const action = await this.actionsService.findOneOrFail({
      id: actionId,
      serverSide: true,
    });
    const form = await this.formRepository.findOneOrFail({
      where: { id: dto.formId },
    });
    const followUpForm = this.followUpFormRepository.create({
      action,
      form,
      ...dto,
      actionId,
    });
    return writeUnderLive(this.followUpFormRepository.manager, {
      parents: [
        { target: Action, id: actionId },
        { target: Form, id: form.id },
      ],
      notFound: "Action or form not found",
      write: async (em) => parseFollowUpForm(await em.save(followUpForm)),
    });
  }

  async updateFollowUpForm(
    followUpFormId: number,
    dto: UpdateFollowUpFormDto,
  ): Promise<ParsedFollowUpForm> {
    const followUpForm = await this.followUpFormRepository.findOneByOrFail({
      id: followUpFormId,
    });
    if (dto.cohortExpression != null) {
      dto.cohortExpression = await parseCohortExpressionForSaveOrThrow({
        em: this.followUpFormRepository.manager,
        value: dto.cohortExpression,
        stored: followUpForm.cohortExpression,
      });
    }
    Object.assign(followUpForm, dto);
    return writeUnderLive(this.followUpFormRepository.manager, {
      parents:
        dto.formId === undefined ? [] : [{ target: Form, id: dto.formId }],
      saved: {
        target: FollowUpForm,
        id: followUpFormId,
        notFound: "Follow-up form not found",
      },
      write: async (em) => parseFollowUpForm(await em.save(followUpForm)),
    });
  }

  async deleteFollowUpForm(followUpFormId: number): Promise<void> {
    const followUpForm = await this.followUpFormRepository.findOne({
      where: { id: followUpFormId },
    });
    if (followUpForm) {
      await softDeleteCascade(this.followUpFormRepository.manager, {
        target: FollowUpForm,
        ids: [followUpForm.id],
      });
    }
  }
}
