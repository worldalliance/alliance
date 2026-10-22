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

  constructor(input: FormResponse) {
    super();
    this.id = input.id;
    this.answers = input.answers;
    this.formulaChoices = input.formulaChoices;
    this.schemaSnapshot = memberSnapshotSchema(
      loadedFormResponseSnapshot(input),
      null,
    );
  }
}

export type FormResponseHistory = { form: Form; responses: FormResponse[] };

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
    this.schema = memberSnapshotSchema(loadedFormSnapshot(input.form), null);
    this.responses = input.responses.map(
      (response) => new FormResponseHistoryEntryDto(response),
    );
  }
}
