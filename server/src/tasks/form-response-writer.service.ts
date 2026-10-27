import type { DeviceVisibilityTarget } from "@alliance/common/forms/device";
import { type FormAnswers } from "@alliance/common/forms/form-responses";
import { FormSchema } from "@alliance/common/forms/form-schema";
import { type FormulaChoices } from "@alliance/common/forms/formula-choices";
import type { AssignedRow } from "@alliance/common/forms/row-list-schema";
import { type VisibilityValidatorResults } from "@alliance/common/forms/visibility";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AiDetectionQueueService } from "src/ai-detection/ai-detection-queue.service";
import { DetectableEntity } from "src/ai-detection/entities/ai-detection-result.entity";
import { Guest } from "src/auth/entities/guest.entity";
import { writeUnderLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import { type Repository } from "typeorm";
import { Form } from "./entities/form.entity";
import {
  FormResponse,
  type ParsedFormResponse,
} from "./entities/formresponse.entity";
import { FormSnapshot } from "./entities/formsnapshot.entity";
import { formSchemaOf } from "./form-snapshot-schema";
import {
  parseSubmittedAnswers,
  readListAnswer,
} from "./form-submission-validation.service";

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

@Injectable()
export class FormResponseWriterService {
  constructor(
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    private aiDetectionQueueService: AiDetectionQueueService,
  ) {}

  async createAndSaveFormResponse({
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
}
