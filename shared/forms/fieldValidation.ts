import {
  type AnyField,
  asCards,
  type FormValue,
  type ListField,
  type ListSubField,
  type NumberField,
} from "@alliance/common/forms/form-schema";
import { getMaxSelections } from "@alliance/common/forms/multiselect";
import {
  isEmptyRangeAnswer,
  isValidRangeSelection,
} from "@alliance/common/forms/range";
import {
  getRankingSlotCount,
  isValidRankingSelection,
} from "@alliance/common/forms/ranking";
import {
  type ConditionExtras,
  isFieldConditionallyRequired,
  listRowData,
  visibleListSubFields,
} from "@alliance/common/forms/visibility";
import { withCount } from "@alliance/common/plural";
import { defaultCardCount, listCardLimits, resolveCards } from "./listCards";
import { parseTimeToMinutes } from "./timeUtils";

export function validateFieldValue(
  field: AnyField,
  fieldValue: FormValue | undefined,
  data: Record<string, FormValue>,
  extras: ConditionExtras,
): string | null {
  const required = isFieldConditionallyRequired(field, data, extras);

  const valueToCheck = fieldValue;
  const isEmptyString =
    typeof valueToCheck === "string" && valueToCheck.trim() === "";

  if (field.kind === "multiselect") {
    const selections = Array.isArray(valueToCheck) ? valueToCheck : [];
    if (required && selections.length === 0) {
      return "Select at least one option.";
    }
    const maxSelections = getMaxSelections(field);
    if (maxSelections !== undefined && selections.length > maxSelections) {
      return `Select no more than ${withCount(maxSelections, "option")}.`;
    }
    return null;
  }

  switch (field.kind) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "date":
    case "timezone":
    case "select": {
      if (!required) return null;
      if (valueToCheck === undefined || valueToCheck === null) {
        return "This field is required.";
      }
      if (isEmptyString) {
        return "This field is required.";
      }
      return null;
    }
    case "time": {
      if (typeof valueToCheck === "string") {
        const minutes = parseTimeToMinutes(valueToCheck);
        if (minutes === null) {
          return "Enter a valid time.";
        }
      }
      if (!required) return null;
      if (valueToCheck === undefined || valueToCheck === null) {
        return "This field is required.";
      }
      if (isEmptyString) {
        return "This field is required.";
      }
      return null;
    }
    case "number": {
      const numValue =
        typeof valueToCheck === "number"
          ? valueToCheck
          : typeof valueToCheck === "string"
            ? parseFloat(valueToCheck)
            : NaN;
      const numberField = field as NumberField;

      if (Number.isNaN(numValue) && !!valueToCheck) {
        return "Please enter a valid number.";
      }
      if (typeof numberField.min === "number" && numValue < numberField.min) {
        return `Value must be at least ${numberField.min}.`;
      }
      if (typeof numberField.max === "number" && numValue > numberField.max) {
        return `Value must be at most ${numberField.max}.`;
      }
      if (
        Number.isFinite(numValue) &&
        !numberField.allowDecimals &&
        !Number.isInteger(numValue)
      ) {
        return "Decimals are not allowed for this field.";
      }
      if (
        Number.isFinite(numValue) &&
        numberField.allowDecimals &&
        typeof numberField.decimalPlaces === "number"
      ) {
        const parts = String(numValue).split(".");
        if (parts.length === 2 && parts[1].length > numberField.decimalPlaces) {
          return `Value must have at most ${withCount(numberField.decimalPlaces, "decimal place")}.`;
        }
      }
      if (!required) return null;
      if (
        valueToCheck === undefined ||
        valueToCheck === null ||
        valueToCheck === ""
      ) {
        return required ? "Please enter a number." : null;
      }

      if (!Number.isFinite(numValue)) {
        return "Please enter a valid number.";
      }
      return null;
    }
    case "range": {
      if (isEmptyRangeAnswer(valueToCheck)) {
        return required ? "Please select a value." : null;
      }
      if (field.kind !== "range") {
        return "Please select a value.";
      }
      if (!isValidRangeSelection(field, valueToCheck)) {
        return "Please select a value.";
      }
      return null;
    }
    case "ranking": {
      if (
        valueToCheck !== undefined &&
        valueToCheck !== null &&
        !isValidRankingSelection(field, valueToCheck)
      ) {
        return "Please redo your ranking.";
      }
      if (!required) return null;
      const slotCount = getRankingSlotCount(field);
      const rankedCount = Array.isArray(valueToCheck) ? valueToCheck.length : 0;
      if (rankedCount < slotCount) {
        return `Rank ${withCount(slotCount, "item")}.`;
      }
      return null;
    }
    case "checkbox":
      if (!required) return null;
      return valueToCheck === true ? null : "This field is required.";
    case "radio":
      if (!required) return null;
      return valueToCheck ? null : "Please select an option.";
    case "file":
      if (!required) return null;
      return valueToCheck ? null : "Please upload a file.";
    case "list": {
      const listField = field as ListField;
      const listValTyped = asCards(valueToCheck) ?? [];
      const { minCards, maxCards } = listCardLimits(listField);
      if (required && listValTyped.length === 0) {
        return "Add at least one item.";
      }
      if (listValTyped.length < minCards) {
        return `Add at least ${withCount(minCards, "item")}.`;
      }
      if (listValTyped.length > maxCards) {
        return `Add no more than ${withCount(maxCards, "item")}.`;
      }
      return null;
    }
    default: {
      if (!required) return null;
      if (valueToCheck === undefined || valueToCheck === null) {
        return "This field is required.";
      }
      if (isEmptyString) {
        return "This field is required.";
      }
      return null;
    }
  }
}

export function getListSubFieldErrors(
  listField: ListField,
  listValue: FormValue | undefined,
  data: Record<string, FormValue>,
  extras: ConditionExtras,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const cards = resolveCards({
    value: listValue,
    defaultCardCount: defaultCardCount(listField),
  });
  const subFields = listField.fields ?? [];
  for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
    const card = cards[cardIndex] ?? {};
    const mergedData = listRowData({ data, row: card });
    const key = (sub: ListSubField) => `${listField.id}:${cardIndex}:${sub.id}`;
    for (const sub of subFields) {
      result[key(sub)] = null;
    }
    for (const sub of visibleListSubFields({
      subFields,
      data,
      row: card,
      extras,
    })) {
      result[key(sub)] = validateFieldValue(
        sub,
        card[sub.id],
        mergedData,
        extras,
      );
    }
  }
  return result;
}
