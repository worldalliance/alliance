import { withCount } from "../plural";
import type { DisplayBlock, DisplayKind } from "./display-blocks";
import {
  isFieldGroup,
  isQuestionField,
  type AnyField,
  type FieldGroup,
  type FieldKind,
  type OutputBlock,
  type OutputFieldBlock,
  type PageItem,
} from "./form-schema";

export const FIELD_KIND_NAMES = {
  text: "Text Field",
  textarea: "Text Area Field",
  email: "Email Field",
  phone: "Phone Field",
  number: "Number Field",
  range: "Range Field",
  checkbox: "Checkbox Field",
  radio: "Radio Field",
  select: "Select Field",
  multiselect: "Multi-select Field",
  ranking: "Ranking Field",
  date: "Date Field",
  time: "Time Field",
  timezone: "Timezone Field",
  city: "City Field",
  file: "File Field",
  contract: "Contract Field",
  list: "List Field",
  custom: "Custom Component Field",
} as const satisfies Record<FieldKind, string>;

export const DISPLAY_KIND_NAMES = {
  header: "Header Block",
  text: "Text Block",
  label: "Label Block",
  divider: "Divider Block",
  spacer: "Spacer Block",
  html: "HTML Block",
  images: "Images Block",
  video: "Video Block",
  quote: "Quote Block",
  biglink: "Big Link Block",
  copytext: "Copy Text Block",
  previousAnswer: "Previous Answer Block",
  userLocation: "User Location Block",
  chatTranscript: "Chat Transcript Block",
  accordion: "Accordion Block",
} as const satisfies Record<DisplayKind, string>;

export const DISPLAY_KINDS = Object.keys(DISPLAY_KIND_NAMES) as DisplayKind[];

/** Whether the form builder offers this kind when adding a new field. */
const FIELD_KIND_ADDABLE = {
  text: false, // superseded by `textarea`
  textarea: true,
  email: true,
  phone: true,
  number: true,
  range: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  ranking: true,
  date: true,
  time: true,
  timezone: true,
  city: true,
  file: true,
  contract: true,
  list: true,
  custom: true,
} as const satisfies Record<FieldKind, boolean>;

export const ADDABLE_FIELD_KINDS = (
  Object.keys(FIELD_KIND_NAMES) as FieldKind[]
).filter((kind) => FIELD_KIND_ADDABLE[kind]);

export function displayBlockPreview(block: DisplayBlock): string {
  switch (block.kind) {
    case "header":
    case "text":
    case "label":
    case "quote":
    case "biglink":
      return block.text;
    case "copytext":
      return block.title || block.text;
    case "divider":
      return block.thickness ?? "";
    case "spacer":
      return block.size ?? "";
    case "html":
      return block.html;
    case "images": {
      const [first, ...rest] = block.images;
      if (!first) return "";
      const label = first.alt || first.src;
      return rest.length ? `${label} +${rest.length} more` : label;
    }
    case "video":
      return block.caption ?? block.src;
    case "previousAnswer":
      return block.title || block.sourceFieldId;
    case "userLocation":
      return block.title ?? "";
    case "chatTranscript":
      return withCount(block.messages.length, "message");
    case "accordion":
      return block.sections.map((section) => section.title).join(", ");
    default:
      block satisfies never;
      return "";
  }
}

function fieldGroupDescriptor(
  group: FieldGroup,
  options?: { typeQualified?: boolean; maxTextLength?: number },
): string {
  const typeName = "Group";
  const label = group.label?.trim();
  if (!label) return options?.typeQualified ? typeName : group.id;
  const text = truncate(label, options?.maxTextLength);
  return options?.typeQualified ? `${typeName}: ${text}` : text;
}

function truncate(text: string, max: number | undefined): string {
  return max !== undefined && text.length > max
    ? `${text.slice(0, max - 1)}…`
    : text;
}

/**
 * `maxTextLength` bounds only the variable part (label, preview, override) and
 * never the id fallback, which is unusable clipped. Truncation is opt-in
 * because most callers — CSV headers, submission errors — need the full text;
 * pass it when the descriptor lands somewhere unwrappable, like an `<option>`.
 */
export function elementInternalDescriptor(
  element: PageItem,
  options?: { typeQualified?: boolean; maxTextLength?: number },
): string {
  if (isFieldGroup(element)) {
    return fieldGroupDescriptor(element, options);
  }
  if (isQuestionField(element)) {
    const typeName = FIELD_KIND_NAMES[element.kind];
    const label = element.label?.trim();
    if (!label) return options?.typeQualified ? typeName : element.id;
    const text = truncate(label, options?.maxTextLength);
    return options?.typeQualified ? `${typeName}: ${text}` : text;
  }

  const typeName = DISPLAY_KIND_NAMES[element.kind];
  const preview = displayBlockPreview(element);
  return preview
    ? `${typeName}: ${truncate(preview, options?.maxTextLength)}`
    : typeName;
}

/** Includes internal field kind and ID; do not use in participant-facing UI. */
export function fieldPickerLabel(
  field: Pick<AnyField, "label" | "id" | "kind">,
): string {
  const label = field.label?.trim();
  return label
    ? `${label} (${field.kind}) — ${field.id}`
    : `${field.id} (${field.kind})`;
}

export function outputBlockLabelOverride(
  block: Pick<OutputFieldBlock, "labelOverride">,
): string | undefined {
  return block.labelOverride?.trim() || undefined;
}

/** May expose internal field IDs; do not use in participant-facing UI. */
export function outputBlockInternalDescriptor(params: {
  block: OutputBlock;
  fieldLookup: ReadonlyMap<string, AnyField>;
  maxTextLength?: number;
}): string {
  const { block, fieldLookup, maxTextLength } = params;
  if ("kind" in block) {
    return elementInternalDescriptor(block, { maxTextLength });
  }
  const override = outputBlockLabelOverride(block);
  if (override) return truncate(override, maxTextLength);
  const field = fieldLookup.get(block.fieldId);
  return field
    ? elementInternalDescriptor(field, { maxTextLength })
    : block.fieldId;
}
