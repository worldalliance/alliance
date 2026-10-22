import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { AnyField, FieldKind } from "@alliance/common/forms/form-schema";
import { fieldWithSavedChoices } from "@alliance/common/forms/formula-choices";
import type { FormResponseDto } from "@alliance/shared/client";
import { isEmptyAnswer, normalizeBoolean } from "./answerValues";
import { getOptionLabel, getSelections } from "./questionAnswer";
import { savedChoicesAcrossResponses } from "./savedChoices";

export type ResponseFilterOp = "equals" | "includes" | "no-response";

export type FormResponseFilter = {
  fieldId: string;
  op: ResponseFilterOp;
  value?: string;
};

export const FILTERABLE_FIELD_KINDS = new Set<FieldKind>([
  "checkbox",
  "radio",
  "select",
  "multiselect",
  "range",
]);

export const isResponseFilterOp = (
  value: string | null,
): value is ResponseFilterOp =>
  value === "equals" || value === "includes" || value === "no-response";

export const matchesResponseFilter = (
  response: FormResponseDto,
  filter: FormResponseFilter,
  field: AnyField,
): boolean => {
  const rawValue = response.answers?.[filter.fieldId];
  if (filter.op === "no-response") {
    return isEmptyAnswer(rawValue);
  }

  switch (field.kind) {
    case "checkbox": {
      if (filter.op !== "equals") return false;
      const desired = normalizeBoolean(filter.value);
      const actual = normalizeBoolean(rawValue);
      if (desired === null || actual === null) return false;
      return actual === desired;
    }
    case "multiselect": {
      if (filter.op !== "includes") return false;
      const selections = getSelections(rawValue);
      return selections.includes(filter.value ?? "");
    }
    case "radio":
    case "select":
    case "range": {
      if (filter.op !== "equals") return false;
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        return false;
      }
      return String(rawValue) === (filter.value ?? "");
    }
    default:
      return false;
  }
};

export function filterDescription(params: {
  filter: FormResponseFilter;
  field: AnyField;
  responses: FormResponseDto[];
}): { fieldLabel: string; description: string } | null {
  const { filter, responses } = params;
  const field = fieldWithSavedChoices(
    params.field,
    savedChoicesAcrossResponses(responses),
  );
  const fieldLabel = elementInternalDescriptor(field);
  if (filter.op === "no-response") {
    return { fieldLabel, description: "No response" };
  }
  const valueLabel = filter.value ?? "";
  switch (field.kind) {
    case "checkbox": {
      const normalized = normalizeBoolean(filter.value);
      if (normalized === true) {
        return { fieldLabel, description: "Checked" };
      }
      if (normalized === false) {
        return { fieldLabel, description: "Not checked" };
      }
      return null;
    }
    case "multiselect": {
      const optionLabel = getOptionLabel(field, filter.value);
      return {
        fieldLabel,
        description: `Includes ${optionLabel ?? valueLabel}`,
      };
    }
    case "radio":
    case "select": {
      const optionLabel = getOptionLabel(field, filter.value);
      return { fieldLabel, description: optionLabel ?? valueLabel };
    }
    case "range":
      return { fieldLabel, description: `Value ${valueLabel}` };
    default:
      return null;
  }
}
