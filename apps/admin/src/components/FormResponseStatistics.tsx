import { FormResponseDto } from "@alliance/shared/client";
import type {
  AnyField,
  FieldKind,
  RangeField,
} from "@alliance/shared/forms/formschema";
import Card from "@alliance/sharedweb/ui/Card";
import FormMarkdownWrapper from "@alliance/sharedweb/ui/FormMarkdownWrapper";
import React, { useMemo } from "react";
import { type FormWithSchema } from "../pages/FormResponses";

export interface FormResponseStatisticsProps {
  form: FormWithSchema | null;
  responses: FormResponseDto[];
}

type StatsFieldKind =
  | "checkbox"
  | "select"
  | "multiselect"
  | "radio"
  | "range"
  | "number";

type StatRow = {
  key: string;
  label: string;
  count: number;
  useMarkdown?: boolean;
};

type FieldStats = {
  field: AnyField;
  kind: StatsFieldKind;
  rows: StatRow[];
  answeredCount: number;
  totalResponses: number;
  summary?: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  note?: string;
};

const STAT_FIELD_KINDS = new Set<FieldKind>([
  "checkbox",
  "select",
  "multiselect",
  "radio",
  "range",
  "number",
]);

const DEFAULT_RANGE_OPTION_COUNT = 10;
const MIN_RANGE_OPTION_COUNT = 2;
const MAX_RANGE_OPTION_COUNT = 50;

const formatPercent = (count: number, total: number): string => {
  if (total <= 0) return "0%";
  const percent = (count / total) * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}%`;
};

const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(2);
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
};

const normalizeBoolean = (value: unknown): boolean | null => {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
};

const getRangeValues = (field: RangeField): number[] => {
  const desired = field.optionCount ?? DEFAULT_RANGE_OPTION_COUNT;
  const normalized = Number.isFinite(desired)
    ? Math.floor(desired)
    : DEFAULT_RANGE_OPTION_COUNT;
  const optionCount = Math.min(
    MAX_RANGE_OPTION_COUNT,
    Math.max(MIN_RANGE_OPTION_COUNT, normalized)
  );
  return Array.from({ length: optionCount }, (_, index) => index + 1);
};

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

const getFieldLabel = (field: AnyField): string =>
  field.label?.trim() || "Untitled question";

const buildNumberStats = (
  values: number[],
  totalResponses: number
): Pick<FieldStats, "rows" | "answeredCount" | "summary"> => {
  if (values.length === 0) {
    const rows =
      totalResponses > 0
        ? [
            {
              key: "no-response",
              label: "No response",
              count: totalResponses,
            },
          ]
        : [];
    return { rows, answeredCount: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const answeredCount = sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / answeredCount;
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];

  if (min === max) {
    return {
      rows: [
        {
          key: "single-value",
          label: formatNumber(min),
          count: answeredCount,
        },
      ],
      answeredCount,
      summary: { min, max, avg, median },
    };
  }

  const desiredBins = Math.ceil(Math.sqrt(sorted.length));
  const binCount = Math.min(8, Math.max(3, desiredBins));
  const span = max - min;
  const step = span / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + index * step,
    end: index === binCount - 1 ? max : min + (index + 1) * step,
    count: 0,
  }));

  sorted.forEach((value) => {
    const index = Math.min(binCount - 1, Math.floor((value - min) / step));
    bins[index].count += 1;
  });

  const rows = bins.map((bin, index) => ({
    key: `bin-${index}`,
    label: `${formatNumber(bin.start)} - ${formatNumber(bin.end)}`,
    count: bin.count,
  }));

  if (answeredCount < totalResponses) {
    rows.push({
      key: "no-response",
      label: "No response",
      count: totalResponses - answeredCount,
    });
  }

  return {
    rows,
    answeredCount,
    summary: { min, max, avg, median },
  };
};

const buildFieldStats = (
  field: AnyField,
  responses: FormResponseDto[],
  totalResponses: number
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
        },
        {
          key: "unchecked",
          label: "Not checked",
          count: uncheckedCount,
        },
      ];
      if (noResponseCount > 0) {
        rows.push({
          key: "no-response",
          label: "No response",
          count: noResponseCount,
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

const StatBar: React.FC<{
  label: React.ReactNode;
  count: number;
  total: number;
}> = ({ label, count, total }) => {
  const percent = total > 0 ? (count / total) * 100 : 0;
  const width = Math.min(percent, 100);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="text-sm text-gray-700 sm:w-48">{label}</div>
      <div className="flex items-center gap-3 flex-1">
        <div className="w-full h-2 bg-gray-100 rounded">
          <div
            className="h-2 rounded bg-blue-500"
            style={{ width: `${width}%` }}
          />
        </div>
        <div className="text-xs text-gray-600 tabular-nums min-w-[90px] text-right">
          {count} ({formatPercent(count, total)})
        </div>
      </div>
    </div>
  );
};

const renderRowLabel = (row: StatRow) => {
  if (row.useMarkdown) {
    return <FormMarkdownWrapper markdownContent={row.label} inline />;
  }
  return <span>{row.label}</span>;
};

const FormResponseStatistics: React.FC<FormResponseStatisticsProps> = ({
  form,
  responses,
}) => {
  const totalResponses = responses.length;

  const statsFields = useMemo(() => {
    if (!form) return [];
    const fields: AnyField[] = [];
    const seen = new Set<string>();
    form.schema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        const candidate = field as AnyField;
        if (
          typeof candidate?.id === "string" &&
          "label" in candidate &&
          STAT_FIELD_KINDS.has(candidate.kind)
        ) {
          if (!seen.has(candidate.id)) {
            fields.push(candidate);
            seen.add(candidate.id);
          }
        }
      });
    });
    return fields;
  }, [form]);

  const statsData = useMemo(
    () =>
      statsFields.map((field) =>
        buildFieldStats(field, responses, totalResponses)
      ),
    [responses, statsFields, totalResponses]
  );

  if (!form) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-gray-600">Loading form statistics...</p>
        </Card>
      </div>
    );
  }

  if (statsFields.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-gray-600">
            No statistics available for this form yet.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {totalResponses === 0 && (
        <Card>
          <p className="text-gray-600">No responses yet for this form.</p>
        </Card>
      )}
      {statsData.map((stat) => {
        const label = getFieldLabel(stat.field);
        return (
          <Card key={stat.field.id} className="gap-4">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-gray-900">
                <FormMarkdownWrapper markdownContent={label} inline />
              </div>
              {stat.note && (
                <div className="text-xs text-gray-400">{stat.note}</div>
              )}
            </div>
            {stat.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Min</div>
                  <div className="text-sm text-gray-900">
                    {formatNumber(stat.summary.min)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Median</div>
                  <div className="text-sm text-gray-900">
                    {formatNumber(stat.summary.median)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Average</div>
                  <div className="text-sm text-gray-900">
                    {formatNumber(stat.summary.avg)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Max</div>
                  <div className="text-sm text-gray-900">
                    {formatNumber(stat.summary.max)}
                  </div>
                </div>
              </div>
            )}
            {stat.rows.length === 0 ? (
              <p className="text-sm text-gray-500">No responses yet.</p>
            ) : (
              <div className="space-y-3">
                {stat.rows.map((row) => (
                  <StatBar
                    key={`${stat.field.id}-${row.key}`}
                    label={renderRowLabel(row)}
                    count={row.count}
                    total={stat.totalResponses}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default FormResponseStatistics;
