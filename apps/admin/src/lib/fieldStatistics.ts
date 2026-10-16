import type {
  AnyField,
  FieldKind,
  RangeField,
} from "@alliance/common/forms/form-schema";
import { getRangeValues } from "@alliance/common/forms/range";
import { FormResponseDto } from "@alliance/shared/client";
import { normalizeBoolean } from "./answerValues";
import {
  buildNumberStats,
  type NumberSummary,
  type StatRow,
} from "./numberStatistics";

type StatsFieldKind =
  | "checkbox"
  | "select"
  | "multiselect"
  | "radio"
  | "range"
  | "number";

type FieldStats = {
  field: AnyField;
  kind: StatsFieldKind;
  rows: StatRow[];
  answeredCount: number;
  totalResponses: number;
  summary?: NumberSummary;
  note?: string;
};

export const STAT_FIELD_KINDS = new Set<FieldKind>([
  "checkbox",
  "select",
  "multiselect",
  "radio",
  "range",
  "number",
]);

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const buildFieldStats = (
  field: AnyField,
  responses: FormResponseDto[],
  totalResponses: number,
): FieldStats => {
  switch (field.kind) {
    case "checkbox": {
      let checkedCount = 0;
      let uncheckedCount = 0;
      let noResponseCount = 0;

      responses.forEach((response) => {
        const normalized = normalizeBoolean(response.answers?.[field.id]);
        if (normalized === true) {
          checkedCount += 1;
        } else if (normalized === false) {
          uncheckedCount += 1;
        } else {
          noResponseCount += 1;
        }
      });

      const rows: StatRow[] = [
        {
          key: "checked",
          label: "Checked",
          count: checkedCount,
          filter: { fieldId: field.id, op: "equals", value: "true" },
        },
        {
          key: "unchecked",
          label: "Not checked",
          count: uncheckedCount,
          filter: { fieldId: field.id, op: "equals", value: "false" },
        },
      ];
      if (noResponseCount > 0) {
        rows.push({
          key: "no-response",
          label: "No response",
          count: noResponseCount,
          filter: { fieldId: field.id, op: "no-response" },
        });
      }

      return {
        field,
        kind: field.kind,
        rows,
        answeredCount: checkedCount + uncheckedCount,
        totalResponses,
      };
    }
    case "radio":
    case "select": {
      const options = field.options ?? [];
      const counts = new Map(options.map((option) => [option.value, 0]));
      let noResponseCount = 0;
      let unknownCount = 0;
      let answeredCount = 0;

      responses.forEach((response) => {
        const rawValue = response.answers?.[field.id];
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          noResponseCount += 1;
          return;
        }
        const value = String(rawValue);
        answeredCount += 1;
        if (counts.has(value)) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        } else {
          unknownCount += 1;
        }
      });

      const rows: StatRow[] = options.map((option) => ({
        key: option.value,
        label: option.label,
        count: counts.get(option.value) ?? 0,
        useMarkdown: true,
        filter: { fieldId: field.id, op: "equals", value: option.value },
      }));
      if (unknownCount > 0) {
        rows.push({
          key: "unknown-option",
          label: "Unknown option",
          count: unknownCount,
        });
      }
      if (noResponseCount > 0) {
        rows.push({
          key: "no-response",
          label: "No response",
          count: noResponseCount,
          filter: { fieldId: field.id, op: "no-response" },
        });
      }

      return {
        field,
        kind: field.kind,
        rows,
        answeredCount,
        totalResponses,
      };
    }
    case "multiselect": {
      const options = field.options ?? [];
      const counts = new Map(options.map((option) => [option.value, 0]));
      let noResponseCount = 0;
      let answeredCount = 0;
      let unknownResponses = 0;

      responses.forEach((response) => {
        const rawValue = response.answers?.[field.id];
        const selections = Array.isArray(rawValue)
          ? rawValue.map(String)
          : rawValue
            ? [String(rawValue)]
            : [];
        if (selections.length === 0) {
          noResponseCount += 1;
          return;
        }
        answeredCount += 1;
        let hasUnknown = false;
        selections.forEach((value) => {
          if (counts.has(value)) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
          } else {
            hasUnknown = true;
          }
        });
        if (hasUnknown) {
          unknownResponses += 1;
        }
      });

      const rows: StatRow[] = options.map((option) => ({
        key: option.value,
        label: option.label,
        count: counts.get(option.value) ?? 0,
        useMarkdown: true,
        filter: { fieldId: field.id, op: "includes", value: option.value },
      }));
      if (unknownResponses > 0) {
        rows.push({
          key: "unknown-option",
          label: "Unknown option",
          count: unknownResponses,
        });
      }
      if (noResponseCount > 0) {
        rows.push({
          key: "no-response",
          label: "No response",
          count: noResponseCount,
          filter: { fieldId: field.id, op: "no-response" },
        });
      }

      return {
        field,
        kind: field.kind,
        rows,
        answeredCount,
        totalResponses,
      };
    }
    case "range": {
      const values = getRangeValues(field as RangeField);
      const counts = new Map(values.map((value) => [value, 0]));
      let noResponseCount = 0;
      let unknownCount = 0;
      let answeredCount = 0;

      responses.forEach((response) => {
        const rawValue = response.answers?.[field.id];
        const numericValue = toNumberValue(rawValue);
        if (numericValue === null) {
          noResponseCount += 1;
          return;
        }
        answeredCount += 1;
        if (counts.has(numericValue)) {
          counts.set(numericValue, (counts.get(numericValue) ?? 0) + 1);
        } else {
          unknownCount += 1;
        }
      });

      const rows: StatRow[] = values.map((value) => ({
        key: String(value),
        label: String(value),
        count: counts.get(value) ?? 0,
        filter: { fieldId: field.id, op: "equals", value: String(value) },
      }));
      if (unknownCount > 0) {
        rows.push({
          key: "unknown-option",
          label: "Unknown option",
          count: unknownCount,
        });
      }
      if (noResponseCount > 0) {
        rows.push({
          key: "no-response",
          label: "No response",
          count: noResponseCount,
          filter: { fieldId: field.id, op: "no-response" },
        });
      }

      const startLabel = field.startLabel?.trim();
      const endLabel = field.endLabel?.trim();
      const note =
        startLabel || endLabel
          ? `Scale: ${startLabel || "start"} to ${endLabel || "end"}`
          : undefined;

      return {
        field,
        kind: field.kind,
        rows,
        answeredCount,
        totalResponses,
        note,
      };
    }
    case "number": {
      const values: number[] = [];
      responses.forEach((response) => {
        const parsed = toNumberValue(response.answers?.[field.id]);
        if (parsed !== null) {
          values.push(parsed);
        }
      });

      const numberStats = buildNumberStats(values, totalResponses);
      return {
        field,
        kind: field.kind,
        rows: numberStats.rows,
        answeredCount: numberStats.answeredCount,
        totalResponses,
        summary: numberStats.summary,
      };
    }
    default:
      return {
        field,
        kind: field.kind as StatsFieldKind,
        rows: [],
        answeredCount: 0,
        totalResponses,
      };
  }
};
