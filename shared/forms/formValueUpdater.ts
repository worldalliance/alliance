import type { FormValue } from "@alliance/common/forms/form-schema";

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
