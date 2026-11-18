import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import { pairedToggleToTurnOn } from "@alliance/common/forms/paired-toggles";

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
 * names turned on, returned as `turnedOn` so its stale error can be cleared.
 */
export function answerField(params: {
  prev: Record<string, FormValue>;
  fieldId: string;
  value: FormValueUpdater;
  fields: Iterable<AnyField>;
  isVisible: (field: AnyField) => boolean;
}): { next: Record<string, FormValue>; turnedOn: string | null } {
  const { prev, fieldId, value, fields, isVisible } = params;
  const next = { ...prev, [fieldId]: resolveFormValue(value, prev[fieldId]) };
  const turnedOn = pairedToggleToTurnOn({
    fieldId,
    data: next,
    fields,
    isVisible,
  });
  if (turnedOn) next[turnedOn] = true;
  return { next, turnedOn };
}
