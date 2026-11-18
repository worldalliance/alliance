import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import {
  pairedToggles,
  pairedToggleToTurnOn,
} from "@alliance/common/forms/paired-toggles";

export type FormValueUpdater =
  | FormValue
  | ((previous: FormValue | undefined) => FormValue);

/**
 * A form renderer's answer-write entry point, which also reconciles validation
 * state. The updater form lets an async write target fresh answers.
 */
export type SetFieldValue = (fieldId: string, value: FormValueUpdater) => void;

export function resolveFormValue(
  update: FormValueUpdater,
  previous: FormValue | undefined,
): FormValue {
  return typeof update === "function" ? update(previous) : update;
}

/**
 * `prev` with `fieldId` answered, and with the toggle `pairedToggleToTurnOn`
 * names turned on. `clearedErrors` clears the error of each toggle paired with
 * `fieldId` or with the toggle turned on that the answer leaves valid.
 */
export function answerField(params: {
  prev: Record<string, FormValue>;
  fieldId: string;
  value: FormValueUpdater;
  fields: Iterable<AnyField>;
  isVisible: (field: AnyField) => boolean;
  validate: (
    field: AnyField,
    value: FormValue | undefined,
    data: Record<string, FormValue>,
  ) => string | null;
}): { next: Record<string, FormValue>; clearedErrors: Record<string, null> } {
  const { prev, fieldId, value, isVisible, validate } = params;
  const fields = [...params.fields];
  const next = { ...prev, [fieldId]: resolveFormValue(value, prev[fieldId]) };
  const partners = pairedToggles(fieldId, fields);
  const turnedOn = pairedToggleToTurnOn({
    fieldId,
    data: next,
    partners,
    isVisible,
  });
  if (turnedOn) next[turnedOn] = true;
  const rechecked = turnedOn
    ? [...partners, ...pairedToggles(turnedOn, fields)]
    : partners;
  const clearedErrors = Object.fromEntries(
    rechecked
      .filter(
        (field) =>
          field.id !== fieldId &&
          validate(field, next[field.id], next) === null,
      )
      .map((field) => [field.id, null] as const),
  );
  return { next, clearedErrors };
}
