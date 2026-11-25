import type { FieldKind } from "./form-schema";

export enum VariableInputMode {
  Number = "number",
  Text = "text",
  Boolean = "boolean",
  /** One `{ label, value }` record. */
  Choice = "choice",
  /** A list of `{ label, value }` records, in the order the answer holds. */
  Choices = "choices",
  /** The city record, plus a `label` reading "Paris, Île-de-France, France". */
  City = "city",
  None = "none",
}

export const FIELD_KIND_VARIABLE_INPUT_MODE: Record<
  FieldKind,
  VariableInputMode
> = {
  number: VariableInputMode.Number,
  range: VariableInputMode.Number,
  text: VariableInputMode.Text,
  textarea: VariableInputMode.Text,
  email: VariableInputMode.Text,
  phone: VariableInputMode.Text,
  date: VariableInputMode.Text,
  time: VariableInputMode.Text,
  timePicker: VariableInputMode.Text,
  timezone: VariableInputMode.Text,
  checkbox: VariableInputMode.Boolean,
  toggle: VariableInputMode.Boolean,
  contract: VariableInputMode.Boolean,
  radio: VariableInputMode.Choice,
  select: VariableInputMode.Choice,
  conversation: VariableInputMode.Choice,
  multiselect: VariableInputMode.Choices,
  ranking: VariableInputMode.Choices,
  city: VariableInputMode.City,
  // A list is read through a `list` input, one record per row. A file holds an
  // upload id and a custom component stores whatever it likes: neither has a
  // reading a formula could put in a sentence.
  list: VariableInputMode.None,
  file: VariableInputMode.None,
  image: VariableInputMode.None,
  custom: VariableInputMode.None,
};

// A newer admin can save a field kind this build predates.
export function isKnownFieldKind(kind: string): kind is FieldKind {
  return Object.hasOwn(FIELD_KIND_VARIABLE_INPUT_MODE, kind);
}

export function variableInputMode(kind: FieldKind): VariableInputMode {
  return isKnownFieldKind(kind)
    ? FIELD_KIND_VARIABLE_INPUT_MODE[kind]
    : VariableInputMode.None;
}

export function isFieldKindReadableByFieldInput(kind: FieldKind): boolean {
  return variableInputMode(kind) !== VariableInputMode.None;
}
