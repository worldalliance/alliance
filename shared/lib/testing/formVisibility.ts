import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type ListField,
  type TextField,
} from "@alliance/common/forms/form-schema";
import {
  VariableAggregatesStatus,
  type VariableAggregates,
} from "../../forms/useVariableAggregates";
import {
  NO_SOURCE_HISTORIES,
  SourceHistoriesStatus,
  type SourceHistories,
} from "../../forms/useVariableSourceHistories";
import { type VisibilityInputsPending } from "../../useFormRenderer";

export const textField = (id: string): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
});

export const listField = (
  id: string,
  fields: ListField["fields"],
): ListField => ({
  id,
  type: "input",
  kind: "list",
  label: id,
  fields,
});

export const schemaWith = (fields: AnyField[]): FormSchema => ({
  pages: [{ id: "p1", fields }],
  outputViews: [],
});

/**
 * A two-page schema whose second page, and the field on it, appear only once
 * `gate` answers "yes".
 */
export const gatedOnYes = {
  conditions: { c1: { kind: "equals" as const, when: "gate", equals: "yes" } },
  formula: "c1",
};

export const twoPageSchema: FormSchema = {
  pages: [
    { id: "p1", fields: [textField("gate")] },
    {
      id: "p2",
      fields: [{ ...textField("detail"), required: true }],
      visibleIfFormula: gatedOnYes,
    },
  ],
  outputViews: [],
};

export function lookupFor(schema: FormSchema): Map<string, AnyField> {
  return new Map(
    schema.pages
      .flatMap((page) => page.fields)
      .filter(isQuestionField)
      .map((field) => [field.id, field]),
  );
}

export const SETTLED_INPUTS: VisibilityInputsPending = {
  visibilityContextLoading: false,
  visibilityContextFailed: false,
  visibilityValidatorsFailed: false,
  userLoading: false,
  previousAnswersPending: false,
};

export const NO_SOURCES_READY: SourceHistories = {
  status: SourceHistoriesStatus.Ready,
  sources: NO_SOURCE_HISTORIES,
};

export const NO_AGGREGATES_READY: VariableAggregates = {
  status: VariableAggregatesStatus.Ready,
  aggregates: new Map(),
};
