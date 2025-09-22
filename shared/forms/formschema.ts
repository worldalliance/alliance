/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DisplayBlock } from "./display-blocks";

// field-kinds.ts
export type FieldKind =
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "phone"
  | "checkbox"
  | "radio"
  | "select"
  | "multiselect"
  | "date"
  | "file";

type Option<V extends string = string> = { label: string; value: V };

// Unified value type for answers (persisted)
export type FormValue = string | number | boolean | string[];

// Base field for dynamic forms (no generics, runtime-first)
interface BaseField<TKind extends FieldKind> {
  id: string;
  kind: TKind;
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: FormValue | null;

  // simple conditions using string IDs
  visibleIf?: Condition;
  requiredIf?: Condition;

  // UI hints
  width?: "full" | "1/2" | "1/3";
}

// Conditions reference other field ids; we type this late with a helper (see defineForm)
export type Condition =
  | { when: string; equals: string | number | boolean | null }
  | { expr: string }; // keep an escape hatch; runtime-evaluated safely

// Specialized fields:

export type TextField = BaseField<"text"> & {
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string; // regex string (runtime checked)
};

export type TextareaField = BaseField<"textarea"> & {
  rows?: number;
  maxLength?: number;
};

export type EmailField = BaseField<"email">;
export type PhoneField = BaseField<"phone"> & {
  placeholder?: string;
  pattern?: string;
};
export type NumberField = BaseField<"number"> & {
  min?: number;
  max?: number;
  step?: number;
};

export type CheckboxField = BaseField<"checkbox">;
export type RadioField = BaseField<"radio"> & { options: Option<string>[] };

export type SelectField = BaseField<"select"> & { options: Option<string>[] };

export type MultiSelectField = BaseField<"multiselect"> & {
  options: Option<string>[];
};

export type DateField = BaseField<"date">; // ISO date string (YYYY-MM-DD)
// Persist file answers as string URL/key
export type FileField = BaseField<"file">;

export type AnyField =
  | TextField
  | TextareaField
  | EmailField
  | PhoneField
  | NumberField
  | CheckboxField
  | RadioField
  | SelectField
  | MultiSelectField
  | DateField
  | FileField;

export interface Page {
  id: string;
  title?: string;
  description?: string;
  fields: Array<AnyField | DisplayBlock>;
}

export interface FormSchema {
  title: string;
  description?: string;
  pages: Page[];
  submit?: { label?: string };
}
