import { parseCityValue } from "@alliance/common/forms/city";
import {
  fieldHasOptions,
  type AnyField,
  type FieldKind,
} from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { imageSrcFromKey } from "@alliance/sharedweb/lib/imageSrc";
import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";

export type CellContent = {
  /** Full text. Searched, sorted on, and shown once the row expands. */
  text: string;
  /** Collapsed one-liner, when clipping `text` would not do. */
  summary?: string;
  /** Rendered in place of the text. */
  node?: ReactNode;
};

export const EMPTY_CELL: CellContent = { text: "" };

type FieldOfKind<K extends FieldKind> = Extract<AnyField, { kind: K }>;

type CellRenderer = (params: {
  field: AnyField;
  value: unknown;
}) => CellContent;

const isFieldOfKind = <K extends FieldKind>(
  field: AnyField,
  kind: K,
): field is FieldOfKind<K> => field.kind === kind;

const forKind =
  <K extends FieldKind>(
    kind: K,
    render: (params: { field: FieldOfKind<K>; value: unknown }) => CellContent,
  ): CellRenderer =>
  ({ field, value }) =>
    isFieldOfKind(field, kind) ? render({ field, value }) : EMPTY_CELL;

const plainText: CellRenderer = ({ value }) =>
  typeof value === "string" || typeof value === "number"
    ? { text: String(value).trim() }
    : EMPTY_CELL;

const optionLabels = (params: {
  field: AnyField;
  values: readonly string[];
}): string[] => {
  const { field, values } = params;
  const options = fieldHasOptions(field) ? field.options : [];
  return values.map(
    (value) => options.find((option) => option.value === value)?.label ?? value,
  );
};

const selectedValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return typeof value === "string" && value ? [value] : [];
};

const booleanCell = (params: {
  value: unknown;
  yes: string;
  no: string;
}): CellContent => {
  const { value, yes, no } = params;
  if (typeof value !== "boolean") return EMPTY_CELL;
  const text = value ? yes : no;
  return {
    text,
    node: value ? (
      <Check aria-label={text} className="size-4 text-emerald-600" />
    ) : (
      <Minus aria-label={text} className="size-4 text-zinc-400" />
    ),
  };
};

const listEntryText = (params: {
  field: FieldOfKind<"list">;
  card: object;
}): string => {
  const { field, card } = params;
  const values: Record<string, unknown> = { ...card };
  return field.fields
    .flatMap((subField) => {
      const content = renderCell({
        field: subField,
        value: values[subField.id],
      });
      const text = content.summary ?? content.text;
      return text ? [text] : [];
    })
    .join(" · ");
};

const CELL_RENDERERS: Record<FieldKind, CellRenderer> = {
  text: plainText,
  textarea: plainText,
  email: plainText,
  phone: plainText,
  number: plainText,
  range: plainText,
  date: plainText,
  time: plainText,
  timezone: plainText,
  custom: plainText,
  // The authored markup decides what the string means, so the table can only
  // show it as written.
  customhtml: plainText,
  checkbox: ({ value }) => booleanCell({ value, yes: "Yes", no: "No" }),
  contract: forKind("contract", ({ field, value }) =>
    booleanCell({
      value,
      yes: field.yesLabel.trim() || "Signed",
      no: field.noLabel.trim() || "Not signed",
    }),
  ),
  radio: ({ field, value }) => {
    const [label] = optionLabels({ field, values: selectedValues(value) });
    return label ? { text: label } : EMPTY_CELL;
  },
  select: ({ field, value }) => {
    const [label] = optionLabels({ field, values: selectedValues(value) });
    return label ? { text: label } : EMPTY_CELL;
  },
  multiselect: ({ field, value }) => {
    const labels = optionLabels({ field, values: selectedValues(value) });
    return labels.length ? { text: labels.join(", ") } : EMPTY_CELL;
  },
  ranking: ({ field, value }) => {
    const labels = optionLabels({ field, values: selectedValues(value) });
    return labels.length
      ? { text: labels.map((label, i) => `${i + 1}. ${label}`).join(", ") }
      : EMPTY_CELL;
  },
  city: ({ value }) => {
    const city = parseCityValue(value);
    return city ? { text: city.name } : EMPTY_CELL;
  },
  file: ({ value }) => {
    if (typeof value !== "string" || !value) return EMPTY_CELL;
    return {
      text: value,
      node: (
        <a
          href={imageSrcFromKey(value)}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="text-blue-600 hover:underline"
        >
          {value}
        </a>
      ),
    };
  },
  list: forKind("list", ({ field, value }) => {
    const cards = Array.isArray(value) ? value : [];
    const entries = cards.flatMap((card) =>
      card && typeof card === "object" && !Array.isArray(card)
        ? [listEntryText({ field, card })]
        : [],
    );
    if (entries.length === 0) return EMPTY_CELL;
    const [first, ...rest] = entries;
    return {
      text: entries.map((entry, i) => `${i + 1}. ${entry}`).join("\n"),
      summary:
        rest.length === 0
          ? first
          : `${first} (+${withCount(rest.length, "other")})`,
    };
  }),
};

export function renderCell(params: {
  field: AnyField;
  value: unknown;
}): CellContent {
  return CELL_RENDERERS[params.field.kind](params);
}
