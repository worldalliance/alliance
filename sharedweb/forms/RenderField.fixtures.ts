import type { AnyField } from "@alliance/common/forms/form-schema";

export const base = {
  id: "question",
  type: "input",
  label: "**Question**",
} as const;
export const options = [
  { label: "First choice", value: "first" },
  { label: "Second choice", value: "second" },
];
export const singleInputs: AnyField[] = [
  { ...base, kind: "text" },
  { ...base, kind: "textarea" },
  { ...base, kind: "email" },
  { ...base, kind: "number" },
  { ...base, kind: "date" },
  { ...base, kind: "file" },
  { ...base, kind: "phone" },
  { ...base, kind: "time" },
  { ...base, kind: "timezone" },
  { ...base, kind: "city" },
  { ...base, kind: "select", options },
  { ...base, kind: "select", options, searchable: true },
  { ...base, kind: "multiselect", options, dropdown: true },
  { ...base, kind: "multiselect", options, dropdown: true, searchable: true },
];
