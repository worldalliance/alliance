import type { AnyField, FieldKind } from "@alliance/common/forms/form-schema";
import {
  ColumnKind,
  MetaColumnId,
  type ResponseRow,
  type TableColumn,
} from "./types";

/** A cell's raw answer plus the text the cell shows, already rendered. */
export type SortableCell = { value: unknown; text: string };

type AnswerComparator = (params: {
  field: AnyField;
  a: SortableCell;
  b: SortableCell;
}) => number;

const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

const compareNumbers = (a: number | null, b: number | null): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toTimestamp = (value: unknown): number | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const compareDates = (a: string | null, b: string | null): number =>
  compareNumbers(
    a === null ? null : Date.parse(a),
    b === null ? null : Date.parse(b),
  );

const byNumber: AnswerComparator = ({ a, b }) =>
  compareNumbers(toNumber(a.value), toNumber(b.value));

const byTimestamp: AnswerComparator = ({ a, b }) =>
  compareNumbers(toTimestamp(a.value), toTimestamp(b.value));

const byText: AnswerComparator = ({ a, b }) => compareText(a.text, b.text);

const byBoolean: AnswerComparator = ({ a, b }) =>
  compareNumbers(
    typeof a.value === "boolean" ? Number(a.value) : null,
    typeof b.value === "boolean" ? Number(b.value) : null,
  );

const ANSWER_COMPARATORS: Record<FieldKind, AnswerComparator> = {
  number: byNumber,
  range: byNumber,
  date: byTimestamp,
  checkbox: byBoolean,
  contract: byBoolean,
  text: byText,
  textarea: byText,
  email: byText,
  phone: byText,
  time: byText,
  timezone: byText,
  city: byText,
  file: byText,
  custom: byText,
  customhtml: byText,
  radio: byText,
  select: byText,
  multiselect: byText,
  ranking: byText,
  list: byText,
};

/** Unanswered cells sort last, whichever comparator the field kind uses. */
export function compareAnswers(params: {
  field: AnyField;
  a: SortableCell;
  b: SortableCell;
}): number {
  const { field, a, b } = params;
  const aEmpty = a.text === "";
  const bEmpty = b.text === "";
  if (aEmpty || bEmpty) return Number(aEmpty) - Number(bEmpty);
  return ANSWER_COMPARATORS[field.kind](params);
}

const cellText = (row: ResponseRow, columnId: string): string =>
  row.cells[columnId]?.text ?? "";

const META_COMPARATORS: Record<
  MetaColumnId,
  (a: ResponseRow, b: ResponseRow) => number
> = {
  [MetaColumnId.Respondent]: (a, b) =>
    compareText(
      cellText(a, MetaColumnId.Respondent),
      cellText(b, MetaColumnId.Respondent),
    ),
  [MetaColumnId.Submitted]: (a, b) =>
    compareDates(a.response.createdAt, b.response.createdAt),
  [MetaColumnId.Variant]: (a, b) =>
    compareText(
      cellText(a, MetaColumnId.Variant),
      cellText(b, MetaColumnId.Variant),
    ),
  [MetaColumnId.Withdrawal]: (a, b) =>
    compareText(
      cellText(a, MetaColumnId.Withdrawal),
      cellText(b, MetaColumnId.Withdrawal),
    ),
  [MetaColumnId.ResponseId]: (a, b) =>
    compareNumbers(a.response.id, b.response.id),
  [MetaColumnId.UserId]: (a, b) =>
    compareNumbers(a.response.user?.id ?? null, b.response.user?.id ?? null),
};

export function compareRows(params: {
  column: TableColumn;
  a: ResponseRow;
  b: ResponseRow;
}): number {
  const { column, a, b } = params;
  if (column.kind === ColumnKind.Meta) {
    return META_COMPARATORS[column.id](a, b);
  }
  const { fieldId, field } = column.question;
  return compareAnswers({
    field,
    a: { value: a.response.answers?.[fieldId], text: cellText(a, column.id) },
    b: { value: b.response.answers?.[fieldId], text: cellText(b, column.id) },
  });
}
