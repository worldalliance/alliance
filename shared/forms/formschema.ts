import type { CitySearchDto } from "../client";
import type { DisplayBlock, ManualDisplayBlockContent } from "./display-blocks";

// field-kinds.ts
export type FieldKind =
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "range"
  | "phone"
  | "checkbox"
  | "radio"
  | "select"
  | "multiselect"
  | "date"
  | "time"
  | "timezone"
  | "file"
  | "city"
  | "contract"
  | "list"
  | "custom";

type Option<V extends string = string> = { label: string; value: V };

// Unified value type for answers (persisted)
export type CityFieldValue = CitySearchDto;
export type ListFieldValue = Record<string, FormValue>[];
export type FormValue =
  | string
  | number
  | boolean
  | string[]
  | CityFieldValue
  | ListFieldValue;

export const DEVICE_VISIBILITY_TARGETS = [
  "mobile",
  "tablet",
  "desktop",
] as const;
export type DeviceVisibilityTarget = (typeof DEVICE_VISIBILITY_TARGETS)[number];

export interface FieldOutputConfig {
  output?: boolean;
  privateByDefault?: boolean;
}

// Base field for dynamic forms (no generics, runtime-first)
interface BaseField<TKind extends FieldKind> {
  id: string;
  kind: TKind;
  label: string | null;
  description?: string;
  required?: boolean;
  defaultValue?: FormValue | null;
  customValidatorId?: number;

  // simple conditions using string IDs
  /** @deprecated Use visibleIfFormula for new logic. Kept for backward compatibility. */
  visibleIf?: Condition[];
  visibleIfFormula?: VisibleIfFormula;
  requiredIf?: Condition;

  // UI hints
  width?: "full" | "1/2" | "1/3";

  output?: FieldOutputConfig;
}

// Conditions reference other field ids; we type this late with a helper (see defineForm)
export type Condition =
  | { when: string; equals: string | number | boolean | null }
  | { when: string; includesOption: string }
  | { when: string; anySelected: boolean }
  | { when: string; hasValue: boolean }
  | { expr: string }
  | { validatorId: number; resultEquals?: boolean } // validators default to expecting true
  | { deviceType: DeviceVisibilityTarget[] };

/** Formula tree for visibility: AND/OR of two operands, NOT of one. Leaves are condition names (e.g. condition1, condition2). */
export type FormulaNode =
  | { op: "AND"; left: FormulaNode | string; right: FormulaNode | string }
  | { op: "OR"; left: FormulaNode | string; right: FormulaNode | string }
  | { op: "NOT"; operand: FormulaNode | string }
  | string;

/** Named conditions (condition1, condition2, ...) plus a formula tree. Replaces visibleIf when present. */
export interface VisibleIfFormula {
  conditions: Record<string, Condition>;
  formula: FormulaNode;
}

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
  placeholder?: string;
};

export type EmailField = BaseField<"email">;
export type PhoneField = BaseField<"phone"> & {
  placeholder?: string;
  pattern?: string;
  autoExtractUserData?: boolean;
};
export type NumberField = BaseField<"number"> & {
  min?: number;
  max?: number;
  step?: number;
};
export type RangeField = BaseField<"range"> & {
  optionCount?: number;
  startLabel?: string;
  endLabel?: string;
};

export type CheckboxExtractionTarget = "shareInfoPublicly";
export type CheckboxPosition = "left" | "right";

export type CheckboxField = BaseField<"checkbox"> & {
  autoExtractUserData?: { target: CheckboxExtractionTarget };
  checkboxPosition?: CheckboxPosition;
};

// Field kinds that support auto-extraction into user data
export const AUTO_EXTRACT_FIELD_KINDS = [
  "phone",
  "time",
  "timezone",
  "city",
  "checkbox",
  "custom",
] as const;
export type AutoExtractFieldKind = (typeof AUTO_EXTRACT_FIELD_KINDS)[number];
export type RadioField = BaseField<"radio"> & {
  options: Option<string>[];
  randomizeOptions?: boolean;
};

export type SelectField = BaseField<"select"> & {
  options: Option<string>[];
  randomizeOptions?: boolean;
};

export type MultiSelectField = BaseField<"multiselect"> & {
  options: Option<string>[];
  randomizeOptions?: boolean;
  maxSelections?: number;
};

export type DateField = BaseField<"date">; // ISO date string (YYYY-MM-DD)
export type TimeField = BaseField<"time"> & {
  autoExtractUserData?: boolean;
}; // Stored as HH:mm (24h) string
export type TimezoneField = BaseField<"timezone"> & {
  autoExtractUserData?: boolean;
};
export type CityField = BaseField<"city"> & {
  placeholder?: string;
  minLength?: number;
  debounceMs?: number;
  autoExtractUserData?: boolean;
};
export type ContractField = BaseField<"contract"> & {
  contractId: number | null;
  contract?: { id: number; markdown: string };
  signQuestion: string;
  yesLabel: string;
  noLabel: string;
};
export type ListField = BaseField<"list"> & {
  fields: AnyField[];
  defaultNumber?: number;
  min?: number;
  max?: number;
  addButtonLabel?: string;
  /** Sub-field ids to hide when rendering this list in an output view. */
  outputViewHiddenFieldIds?: string[];
  /** Prefill this list's cards from a previous form's list field answer. */
  prefillFromPreviousAnswer?: {
    sourceFormId: number;
    sourceFieldId: string;
    sourceSubFieldId: string;
    targetSubFieldId: string;
  };
};
// Persist file answers as string URL/key
export type FileField = BaseField<"file">;
export type CustomComponentField = BaseField<"custom"> & {
  componentId: string;
  componentConfig?: Record<string, unknown>;
  autoExtractUserData?: { target: CheckboxExtractionTarget };
};

export type AnyField =
  | TextField
  | TextareaField
  | EmailField
  | PhoneField
  | NumberField
  | RangeField
  | CheckboxField
  | RadioField
  | SelectField
  | MultiSelectField
  | DateField
  | TimeField
  | TimezoneField
  | CityField
  | FileField
  | ContractField
  | ListField
  | CustomComponentField;

export interface Page {
  id: string;
  title?: string;
  description?: string;
  fields: Array<AnyField | DisplayBlock>;
}

export type ManualDisplayBlockContentMap = Record<
  string,
  ManualDisplayBlockContent
>;

export interface FormSchema {
  title: string;
  description?: string;
  pages: Page[];
  submit?: { label?: string };

  outputViews: OutputViewSchema[];
}

export type OutputBlock = DisplayBlock | OutputFieldBlock;

export interface OutputFieldBlock {
  id: string;
  fieldId: string;
  showLabel?: boolean;
  labelOverride?: string;
  format?: "field" | "textonly" | "card";
  /** @deprecated Use visibleIfFormula. */
  visibleIf?: Condition[];
  visibleIfFormula?: VisibleIfFormula;
}

export interface OutputViewSchema {
  type: "default" | "page" | "card" | "personal";
  id: string;
  title?: string;
  description?: string;
  blocks: OutputBlock[];
}
