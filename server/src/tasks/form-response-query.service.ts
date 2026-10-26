import {
  type VariableAggregateSource,
  variableAggregateSources,
} from "@alliance/common/forms/variable-aggregates";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { AiDetectionQueryService } from "src/ai-detection/ai-detection-query.service";
import { DetectableEntity } from "src/ai-detection/entities/ai-detection-result.entity";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import { In, IsNull, type Repository } from "typeorm";
import { Form } from "./entities/form.entity";
import {
  FormResponse,
  type ParsedFormResponse,
  parseFormResponse,
} from "./entities/formresponse.entity";
import { type FormResponseHistory } from "./form-response-history.dto";
import { formSchemaOf } from "./form-snapshot-schema";
import { type FormResponseCount, FormResponseDto } from "./form.dto";
import { FormSnapshotService } from "./formsnapshot.service";
import {
  countVariableAggregates,
  type VariableAggregate,
} from "./variable-aggregates";

@Injectable()
export class FormResponseQueryService {
  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    private aiDetectionQueryService: AiDetectionQueryService,
    private formSnapshotService: FormSnapshotService,
    private actionFormVariantService: ActionFormVariantService,
    private shareUrlsService: ShareUrlsService,
  ) {}

  async getFormResponses(formId: number): Promise<FormResponseDto[]> {
    return this.getFormResponsesForForms([formId]);
  }

  async getFormResponseCountsForForms(
    formIds: number[],
  ): Promise<FormResponseCount[]> {
    if (formIds.length === 0) {
      return [];
    }
    const rows = await this.formResponseRepository
      .createQueryBuilder("response")
      .select("response.formId", "formId")
      .addSelect("COUNT(*)", "count")
      .where("response.formId IN (:...formIds)", { formIds })
      .groupBy("response.formId")
      .getRawMany<{ formId: number; count: string }>();
    const countByFormId = new Map(
      rows.map((row) => [row.formId, Number(row.count)]),
    );
    // A form with no responses has no row to group, so fill it in here rather
    // than leaving the caller to infer the zero from what is missing.
    return formIds.map((formId) => ({
      formId,
      count: countByFormId.get(formId) ?? 0,
    }));
  }

  async getFormResponsesForForms(
    formIds: number[],
  ): Promise<FormResponseDto[]> {
    if (formIds.length === 0) {
      return [];
    }
    const responses = await this.formResponseRepository.find({
      where: { formId: In(formIds) },
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
          response: parseFormResponse(response),
          aiDetectionResults: aiDetectionByResponseId.get(response.id),
        }),
    );
  }

  async getMyFormResponse(
    userId: number,
    formId: number,
  ): Promise<ParsedFormResponse> {
    const response = await this.formResponseRepository.findOne({
      where: { formId, user: { id: userId } },
      relations: { formSnapshot: true, user: true },
      order: { createdAt: "DESC", id: "DESC" },
    });
    if (!response) {
      throw new NotFoundException("Form response not found");
    }
    return parseFormResponse(response);
  }

  async getFormResponseHistory(params: {
    userId: number;
    formId: number;
  }): Promise<FormResponseHistory> {
    const { userId, formId } = params;
    const form = await this.formRepository.findOne({
      where: { id: formId },
      relations: { formSnapshot: true },
    });
    if (!form) throw new NotFoundException("Form not found");
    const responses = await this.formResponseRepository.find({
      where: { formId, user: { id: userId } },
      relations: { formSnapshot: true },
      order: { createdAt: "ASC", id: "ASC" },
    });
    return { form, responses };
  }

  formulaSourceHistoryLoader(
    userId: number,
  ): (formId: number) => Promise<FormResponseHistory | undefined> {
    return (formId) =>
      this.getFormResponseHistory({ userId, formId }).catch(
        (error: unknown) => {
          if (error instanceof NotFoundException) return undefined;
          throw error;
        },
      );
  }

  /**
   * Counts the aggregate inputs of one version of a form. The version, not the
   * caller, decides which questions are counted.
   */
  async countFormVersionAggregates(params: {
    formId: number;
    formSnapshotId: number;
  }): Promise<VariableAggregate[]> {
    const snapshot = await this.formSnapshotService.findHistoricalOrThrow(
      params.formId,
      params.formSnapshotId,
    );
    return countVariableAggregates({
      em: this.formRepository.manager,
      sources: variableAggregateSources(formSchemaOf(snapshot).variables),
    });
  }

  countVariableAggregates(
    sources: readonly VariableAggregateSource[],
  ): Promise<VariableAggregate[]> {
    return countVariableAggregates({
      em: this.formRepository.manager,
      sources,
    });
  }

  async getGuestFormResponse(
    guestId: string,
    formId: number,
  ): Promise<ParsedFormResponse | null> {
    const response = await this.formResponseRepository.findOne({
      where: { formId, guest: { id: guestId, linkedUser: IsNull() } },
      relations: { formSnapshot: true },
      order: { createdAt: "DESC", id: "DESC" },
    });
    return response && parseFormResponse(response);
  }

  async getLinkedGuestDraftFormResponse(params: {
    userId: number;
    formId: number;
    actionId: number;
  }): Promise<ParsedFormResponse | null> {
    const { userId, formId, actionId } = params;
    const owners = await this.actionFormVariantService.findActionIdByFormId([
      actionId,
    ]);
    if (owners.get(formId) !== actionId) {
      throw new ForbiddenException(
        "This form is not one of the action's forms",
      );
    }
    // If the user has already submitted this action as an authenticated user,
    // any linked-guest draft is stale and shouldn't be surfaced as a prefill.
    const submitted = await this.actionFormVariantService.findSubmittedFormIds({
      actionIds: [actionId],
      userId,
    });
    if (submitted.has(actionId)) {
      return null;
    }
    const draft = await this.formResponseRepository.findOne({
      where: { formId, guest: { linkedUser: { id: userId } } },
      relations: { formSnapshot: true },
      order: { createdAt: "DESC", id: "DESC" },
    });
    return draft && parseFormResponse(draft);
  }

  async getFormsForUserSID(userId: number): Promise<ParsedFormResponse[]> {
    const sids = await this.shareUrlsService.findActionShareSidsForUser(userId);
    if (sids.length === 0) {
      return [];
    }
    const responses = await this.formResponseRepository.find({
      where: { sid: In(sids) },
      relations: { formSnapshot: true },
    });
    return responses.map(parseFormResponse);
  }
}
