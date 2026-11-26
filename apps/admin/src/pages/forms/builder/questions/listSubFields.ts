import type {
  FieldKind,
  ListSubField,
} from "@alliance/common/forms/form-schema";

const SUB_FIELD_KINDS_OPTIONS = {
  textarea: true,
  number: true,
  email: true,
  phone: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  date: true,
  time: true,
  timezone: true,
  city: true,
  file: true,
  range: true,
} as const satisfies Record<
  Exclude<
    FieldKind,
    | "list"
    | "contract"
    | "custom"
    | "text"
    | "ranking"
    | "image"
    | "toggle"
    | "timePicker"
    | "conversation"
  >,
  unknown
>;
export type SubFieldKind = keyof typeof SUB_FIELD_KINDS_OPTIONS;

export const SUB_FIELD_KINDS = Object.keys(
  SUB_FIELD_KINDS_OPTIONS,
) as SubFieldKind[];

export function createDefaultSubField(
  parentId: string,
  kind: SubFieldKind,
): ListSubField {
  const id = `${parentId}-sub-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const base = {
    id,
    type: "input" as const,
    kind,
    label: `${kind.charAt(0).toUpperCase() + kind.slice(1)}`,
    required: false,
  };
  switch (kind) {
    case "textarea":
      return { ...base, kind: "textarea", rows: 1 };
    case "number":
      return { ...base, kind: "number" };
    case "email":
      return { ...base, kind: "email" };
    case "phone":
      return { ...base, kind: "phone", placeholder: "Enter phone number" };
    case "checkbox":
      return { ...base, kind: "checkbox" };
    case "radio":
      return {
        ...base,
        kind: "radio",
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "select":
      return {
        ...base,
        kind: "select",
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "multiselect":
      return {
        ...base,
        kind: "multiselect",
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "date":
      return { ...base, kind: "date" };
    case "time":
      return { ...base, kind: "time" };
    case "timezone":
      return { ...base, kind: "timezone" };
    case "city":
      return { ...base, kind: "city", placeholder: "Search for a city" };
    case "file":
      return { ...base, kind: "file" };
    case "range":
      return {
        ...base,
        kind: "range",
        optionCount: 10,
        startLabel: "",
        endLabel: "",
      };
    default:
      kind satisfies never;
      return { ...base, kind: "textarea", rows: 1 };
  }
}
