import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
import {
  type AnyField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { selectedFormulaChoices } from "@alliance/common/forms/formula-choices";
import { type ResolvedOptions } from "@alliance/common/forms/formula-options";
import { type VisibilityValidatorResults } from "@alliance/common/forms/visibility";
import { type FormResponseDto } from "@alliance/shared/client";
import { sanitizedAnswers } from "@alliance/shared/forms/formDrafts";

/** A preview's answers shaped as the response a submit would have saved; nothing is sent. */
export function previewFormResponse(params: {
  schema: FormSchema;
  formId: number;
  formSnapshotId: number;
  answers: Record<string, FormValue>;
  fieldLookup: Map<string, AnyField>;
  publicAnswers: Record<string, boolean>;
  options: ResolvedOptions;
  visibilityValidatorResults: VisibilityValidatorResults;
  deviceType: DeviceVisibilityTarget;
}): FormResponseDto {
  const {
    schema,
    formId,
    formSnapshotId,
    publicAnswers,
    options,
    visibilityValidatorResults,
    deviceType,
  } = params;
  const answers = sanitizedAnswers(params.answers, params.fieldLookup);
  return {
    id: 0,
    formId,
    formSnapshotId,
    createdAt: new Date().toISOString(),
    answers,
    publicAnswers,
    schemaSnapshot: schema,
    formulaChoices: selectedFormulaChoices({ schema, answers, options }),
    visibilityValidatorResults,
    assignedRow: null,
    deviceType,
    phDistinctId: null,
    sessionReplayUrl: null,
    sid: null,
  };
}
