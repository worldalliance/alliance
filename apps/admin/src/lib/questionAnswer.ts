import {
  type AnyField,
  fieldHasOptions,
} from "@alliance/common/forms/form-schema";
import { fieldWithSavedChoices } from "@alliance/common/forms/formula-options";
import type { FormResponseDto } from "@alliance/shared/client";
import { parseFormulaChoices } from "@alliance/shared/parsed-dtos";

export const getSelections = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
};

export const getOptionLabel = (
  field: AnyField,
  value: string | undefined,
): string | undefined => {
  if (!value || !fieldHasOptions(field)) return undefined;
  return field.options.find((option) => option.value === value)?.label;
};

/**
 * A choice question's answer in the labels its response read, including the
 * choices a formula field saved. Undefined for a question without choices.
 */
export function choiceAnswerText(params: {
  field: AnyField;
  value: unknown;
  response: FormResponseDto;
}): string | undefined {
  const { value, response } = params;
  const field = fieldWithSavedChoices(
    params.field,
    parseFormulaChoices(response.formulaChoices),
  );

  switch (field.kind) {
    case "radio":
    case "select": {
      const normalized =
        value === null || value === undefined ? "" : String(value);
      if (!normalized) return "No response";
      return getOptionLabel(field, normalized) ?? normalized;
    }
    case "multiselect": {
      const selections = getSelections(value);
      if (selections.length === 0) return "No response";
      return selections
        .map((selection) => getOptionLabel(field, selection) ?? selection)
        .join(", ");
    }
    case "ranking": {
      const ranked = getSelections(value);
      if (ranked.length === 0) return "No response";
      return ranked
        .map(
          (option, index) =>
            `${index + 1}. ${getOptionLabel(field, option) ?? option}`,
        )
        .join(", ");
    }
    default:
      return undefined;
  }
}
