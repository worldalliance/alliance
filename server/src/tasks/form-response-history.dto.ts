import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDefined } from "class-validator";
import { Form, loadedFormSnapshot } from "./entities/form.entity";
import {
  FormResponse,
  loadedFormResponseSnapshot,
} from "./entities/formresponse.entity";
import { memberSnapshotSchema } from "./form-snapshot-schema";

export class FormResponseHistoryEntryDto extends PickType(FormResponse, [
  "id",
  "answers",
  "formulaChoices",
]) {
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schemaSnapshot: Record<string, unknown>;

  constructor(input: FormResponseHistoryEntry) {
    super();
    const { response, userId } = input;
    this.id = response.id;
    this.answers = response.answers;
    this.formulaChoices = response.formulaChoices;
    this.schemaSnapshot = memberSnapshotSchema(
      loadedFormResponseSnapshot(response),
      { assignedRow: null, userId },
    );
  }
}

export type FormResponseHistoryEntry = {
  response: FormResponse;
  userId: number;
};

export type FormResponseHistory = {
  form: Form;
  responses: FormResponse[];
  /** The member whose responses these are. */
  userId: number;
};

export class FormResponseHistoryDto {
  /** The form's current schema. */
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema: Record<string, unknown>;

  /** Submitted responses, oldest first. */
  @ApiProperty({ type: () => FormResponseHistoryEntryDto, isArray: true })
  @IsDefined()
  @Type(() => FormResponseHistoryEntryDto)
  responses: FormResponseHistoryEntryDto[];

  constructor(input: FormResponseHistory) {
    const { form, responses, userId } = input;
    this.schema = memberSnapshotSchema(loadedFormSnapshot(form), {
      assignedRow: null,
      userId,
    });
    this.responses = responses.map(
      (response) => new FormResponseHistoryEntryDto({ response, userId }),
    );
  }
}
