import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { AnyField } from "@alliance/common/forms/form-schema";
import { fieldWithSavedChoices } from "@alliance/common/forms/formula-options";
import type { FormResponseDto } from "@alliance/shared/client";
import { normalizeBoolean } from "./answerValues";
import { getOptionLabel } from "./questionAnswer";
import { savedChoicesAcrossResponses } from "./savedChoices";

export type ResponseFilterOp = "equals" | "includes" | "no-response";

export type FormResponseFilter = {
  fieldId: string;
  op: ResponseFilterOp;
  value?: string;
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
