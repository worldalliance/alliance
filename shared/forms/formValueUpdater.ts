import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import {
  pairedToggleRequired,
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
 * names turned on. `clearedErrors` clears the errors the answer resolves, once
 * their toggle validates: the turned-on toggle's, and the required error of
 * each toggle paired with `fieldId` or with it that was off and required by
 * its pairing. The caller validates `fieldId` itself.
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
          (field.id === turnedOn ||
            (prev[field.id] !== true && pairedToggleRequired(field, prev))) &&
          validate(field, next[field.id], next) === null,
      )
      .map((field) => [field.id, null] as const),
  );
  return { next, clearedErrors };
}
