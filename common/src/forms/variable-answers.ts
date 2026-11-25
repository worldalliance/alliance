import { formatCityValue, parseCityValue } from "./city";
import type { ExprRecord, ExprValue } from "./variable-expression";
import { VariableInputMode, variableInputMode } from "./variable-input-mode";
import type { VariableInputField } from "./variables";

function numberFromAnswer(value: unknown): ExprValue {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  // Number fields round-trip through text inputs, so a numeric answer often
  // arrives as a string.
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) ? asNumber : undefined;
}

function textFromAnswer(value: unknown): ExprValue {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function booleanFromAnswer(value: unknown): ExprValue {
  return typeof value === "boolean" ? value : undefined;
}

// Use the stored value as the label when an option was removed.
function choiceRecord(
  value: string,
  field: VariableInputField,
): ExprRecord | undefined {
  if (!value) return undefined;
  const option = field.options?.find((candidate) => candidate.value === value);
  const category = field.categories?.find(
    (candidate) => candidate.id === option?.category,
  )?.name;
  return {
    label: option?.label ?? value,
    value,
    ...(category !== undefined && { category }),
  };
}

function choiceFromAnswer(
  value: unknown,
  field: VariableInputField,
): ExprValue {
  return typeof value === "string" ? choiceRecord(value, field) : undefined;
}

function choicesFromAnswer(
  value: unknown,
  field: VariableInputField,
): ExprValue {
  if (!Array.isArray(value)) return undefined;
  const records = value.flatMap((item: unknown) => {
    const record =
      typeof item === "string" ? choiceRecord(item, field) : undefined;
    return record ? [record] : [];
  });
  // Nothing selected reads the same as nothing answered, so `??` can step in.
  return records.length > 0 ? records : undefined;
}

function cityFromAnswer(value: unknown): ExprValue {
  const city = parseCityValue(value);
  return city === undefined
    ? undefined
    : { ...city, label: formatCityValue(city) };
}

const ANSWER_READERS: Record<
  VariableInputMode,
  (value: unknown, field: VariableInputField) => ExprValue
> = {
  [VariableInputMode.Number]: numberFromAnswer,
  [VariableInputMode.Text]: textFromAnswer,
  [VariableInputMode.Boolean]: booleanFromAnswer,
  [VariableInputMode.Choice]: choiceFromAnswer,
  [VariableInputMode.Choices]: choicesFromAnswer,
  [VariableInputMode.City]: cityFromAnswer,
  [VariableInputMode.None]: () => undefined,
};

/**
 * Converts a stored answer according to its field kind. Unanswered and blank
 * fields become `undefined` so `??` can supply a default.
 */
export function formValueToExprValue(
  value: unknown,
  field: VariableInputField,
): ExprValue {
  if (value === undefined || value === null) return undefined;
  return ANSWER_READERS[variableInputMode(field.kind)](value, field);
}
