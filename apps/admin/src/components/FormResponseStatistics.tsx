import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { AnyField } from "@alliance/common/forms/form-schema";
import { isQuestionField } from "@alliance/common/forms/form-schema";
import { fieldWithSavedChoices } from "@alliance/common/forms/formula-choices";
import { FormResponseDto } from "@alliance/shared/client";
import { ChevronRight } from "lucide-react";
import React, { useId, useMemo } from "react";
import { buildFieldStats, STAT_FIELD_KINDS } from "../lib/fieldStatistics";
import { formatCount } from "../lib/formatNumber";
import { formatNumber, type StatRow } from "../lib/numberStatistics";
import { type FormResponseFilter } from "../lib/responseFilter";
import { savedChoicesAcrossResponses } from "../lib/savedChoices";
import { chartColor, SERIES } from "../ui/charts/chartColor";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import { Skeleton } from "../ui/Skeleton";
import { PanelStat } from "../ui/templates/Overview";
import { ContentState } from "../ui/templates/States";
import { type FormWithSchema } from "./FormResponsesView";

export interface FormResponseStatisticsProps {
  form: FormWithSchema | null;
  responses: FormResponseDto[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onFilterSelect?: (filter: FormResponseFilter) => void;
}

const formatPercent = (count: number, total: number): string => {
  if (total <= 0) return "0%";
  const percent = (count / total) * 100;
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}%`;
};

const ROW = "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left";

function StatBar({
  row,
  total,
  onSelect,
}: {
  row: StatRow;
  total: number;
  onSelect?: () => void;
}) {
  const share = total > 0 ? Math.min((row.count / total) * 100, 100) : 0;
  const content = (
    <>
      <span className="min-w-0 shrink basis-64 wrap-break-word">
        {row.useMarkdown ? (
          <FormMarkdownWrapper markdownContent={row.label} inline />
        ) : (
          row.label
        )}
      </span>
      <span
        aria-hidden="true"
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: chartColor.track }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${share}%`, backgroundColor: SERIES[0] }}
        />
      </span>
      <span className="w-14 shrink-0 text-right font-medium tabular-nums">
        {formatCount(row.count)}
      </span>
      <span className="w-14 shrink-0 text-right text-fg-muted tabular-nums">
        {formatPercent(row.count, total)}
      </span>
      <ChevronRight
        aria-hidden="true"
        className={
          onSelect ? "size-4 shrink-0 text-fg-muted" : "invisible size-4"
        }
      />
    </>
  );
  return (
    <li>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className={`${ROW} focus-ring hover:bg-surface-2`}
        >
          {content}
          <span className="sr-only">Show these responses in Replays</span>
        </button>
      ) : (
        <div className={ROW}>{content}</div>
      )}
    </li>
  );
}

function StatCard({
  stat,
  onFilterSelect,
}: {
  stat: ReturnType<typeof buildFieldStats>;
  onFilterSelect?: (filter: FormResponseFilter) => void;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface"
    >
      <div className="flex min-h-12 flex-wrap items-baseline gap-x-2 border-b border-line px-card py-3">
        <h2 id={titleId} className="text-heading font-semibold">
          <FormMarkdownWrapper
            markdownContent={elementInternalDescriptor(stat.field)}
            inline
          />
        </h2>
        {stat.note && (
          <span className="text-caption text-fg-muted">{stat.note}</span>
        )}
      </div>
      {stat.summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 border-b border-line px-card py-3">
          <PanelStat label="Min" value={formatNumber(stat.summary.min)} />
          <PanelStat label="Median" value={formatNumber(stat.summary.median)} />
          <PanelStat label="Average" value={formatNumber(stat.summary.avg)} />
          <PanelStat label="Max" value={formatNumber(stat.summary.max)} />
          <PanelStat label="Total" value={formatNumber(stat.summary.total)} />
        </div>
      )}
      <ul className="flex flex-col p-3">
        {stat.rows.map((row) => {
          const { filter } = row;
          return (
            <StatBar
              key={row.key}
              row={row}
              total={stat.totalResponses}
              onSelect={
                filter && onFilterSelect
                  ? () => onFilterSelect(filter)
                  : undefined
              }
            />
          );
        })}
      </ul>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-col gap-section"
    >
      {[4, 3].map((rows, card) => (
        <div
          key={card}
          aria-hidden="true"
          className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card"
        >
          <Skeleton className="h-5 w-72" />
          {Array.from({ length: rows }, (_, row) => (
            <Skeleton key={row} className="h-3.5 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

const FormResponseStatistics: React.FC<FormResponseStatisticsProps> = ({
  form,
  responses,
  loading,
  error,
  onRetry,
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
          STAT_FIELD_KINDS[field.kind]
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

  const noStats = statsFields.length === 0;

  return (
    <ContentState
      loading={loading || !form}
      skeleton={<StatsSkeleton />}
      error={error}
      errorTitle="Couldn't load responses"
      onRetry={onRetry}
      empty={noStats || totalResponses === 0}
      emptyTitle={noStats ? "No statistics for this form" : "No responses yet"}
      emptyDescription={
        noStats
          ? "Statistics cover number, range, checkbox, toggle, choice and conversation questions, and this form has none."
          : undefined
      }
    >
      <div className="flex flex-col gap-section">
        {onFilterSelect &&
          statsData.some((stat) => stat.rows.some((row) => row.filter)) && (
            <p className="text-fg-muted">
              Select an answer to see the responses that gave it, in Replays.
            </p>
          )}
        {statsData.map((stat) => (
          <StatCard
            key={stat.field.id}
            stat={stat}
            onFilterSelect={onFilterSelect}
          />
        ))}
      </div>
    </ContentState>
  );
};

export default FormResponseStatistics;
