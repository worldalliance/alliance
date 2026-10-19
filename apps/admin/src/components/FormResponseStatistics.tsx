import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { AnyField } from "@alliance/common/forms/form-schema";
import { isQuestionField } from "@alliance/common/forms/form-schema";
import { fieldWithSavedChoices } from "@alliance/common/forms/formula-choices";
import { FormResponseDto } from "@alliance/shared/client";
import Card from "@alliance/sharedweb/ui/Card";
import FormMarkdownWrapper from "@alliance/sharedweb/ui/FormMarkdownWrapper";
import React, { useMemo } from "react";
import { buildFieldStats, STAT_FIELD_KINDS } from "../lib/fieldStatistics";
import { formatNumber, type StatRow } from "../lib/numberStatistics";
import { type FormResponseFilter } from "../lib/responseFilter";
import { savedChoicesAcrossResponses } from "../lib/savedChoices";
import { type FormWithSchema } from "./FormResponsesView";

export interface FormResponseStatisticsProps {
  form: FormWithSchema | null;
  responses: FormResponseDto[];
  onFilterSelect?: (filter: FormResponseFilter) => void;
}

const formatPercent = (count: number, total: number): string => {
  if (total <= 0) return "0%";
  const percent = (count / total) * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}%`;
};

const StatBar: React.FC<{
  label: React.ReactNode;
  count: number;
  total: number;
  onClick?: () => void;
}> = ({ label, count, total, onClick }) => {
  const percent = total > 0 ? (count / total) * 100 : 0;
  const width = Math.min(percent, 100);
  const content = (
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
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-gray-50"
      >
        {content}
      </button>
    );
  }
  return content;
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
  onFilterSelect,
}) => {
  const totalResponses = responses.length;

  const statsFields = useMemo(() => {
    if (!form) return [];
    const fields: AnyField[] = [];
    const seen = new Set<string>();
    form.schema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (
          isQuestionField(field) &&
          typeof field.id === "string" &&
          STAT_FIELD_KINDS.has(field.kind)
        ) {
          if (!seen.has(field.id)) {
            fields.push(field);
            seen.add(field.id);
          }
        }
      });
    });
    return fields;
  }, [form]);

  const statsData = useMemo(() => {
    const saved = savedChoicesAcrossResponses(responses);
    return statsFields.map((field) =>
      buildFieldStats(
        fieldWithSavedChoices(field, saved),
        responses,
        totalResponses,
      ),
    );
  }, [responses, statsFields, totalResponses]);

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
        <p className="text-gray-600">No statistics available for this form.</p>
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
        const label = elementInternalDescriptor(stat.field);
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                <div>
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="text-sm text-gray-900">
                    {formatNumber(stat.summary.total)}
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
                    onClick={
                      row.filter && onFilterSelect
                        ? () => onFilterSelect(row.filter!)
                        : undefined
                    }
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
