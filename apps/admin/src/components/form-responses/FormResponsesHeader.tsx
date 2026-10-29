import { withCount } from "@alliance/common/plural";
import type { FormResponseDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useMemo } from "react";
import type { ResponseVariantOption } from "../FormResponsesView";

type Tab = "responses" | "stats" | "questions" | "replays";

export const isTab = (value: string | null): value is Tab =>
  value === "responses" ||
  value === "stats" ||
  value === "questions" ||
  value === "replays";

type FormResponsesHeaderProps = {
  title: string;
  /** Every response, unscoped by variant. */
  responses: FormResponseDto[];
  /** Responses in the selected variant. */
  total: number;
  referralsError?: string | null;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  variantOptions?: ResponseVariantOption[];
  selectedVariantKey: string;
  onVariantChange: (key: string | null) => void;
  onRefresh: () => void;
  /** Shows the "Reassign snapshots" button when present. */
  onReassignSnapshots?: () => void;
  onExportCsv: () => void;
  onExportHtml: () => void;
};

const FormResponsesHeader: React.FC<FormResponsesHeaderProps> = ({
  title,
  responses,
  total,
  referralsError,
  tab,
  onTabChange,
  variantOptions,
  selectedVariantKey,
  onVariantChange,
  onRefresh,
  onReassignSnapshots,
  onExportCsv,
  onExportHtml,
}) => {
  // Every response, so the date does not move with the search or a filter.
  const releaseDate = useMemo(() => {
    const earliest = responses.reduce<string | null>(
      (oldest, response) =>
        oldest === null || response.createdAt < oldest
          ? response.createdAt
          : oldest,
      null,
    );
    return earliest
      ? new Date(earliest).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  }, [responses]);

  return (
    <div className="px-6 py-4 space-y-3">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {releaseDate && (
            <span className="text-sm text-gray-500">
              Released {releaseDate}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">{withCount(total, "response")}</p>
        {referralsError && (
          <p className="text-sm text-red-500">{referralsError}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 whitespace-nowrap">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => onTabChange("responses")}
            color={tab === "responses" ? ButtonColor.Black : ButtonColor.White}
            size="small"
          >
            Responses
          </Button>
          <Button
            onClick={() => onTabChange("stats")}
            color={tab === "stats" ? ButtonColor.Black : ButtonColor.White}
            size="small"
          >
            Stats
          </Button>
          <Button
            onClick={() => onTabChange("questions")}
            color={tab === "questions" ? ButtonColor.Black : ButtonColor.White}
            size="small"
          >
            Questions
          </Button>
          <Button
            onClick={() => onTabChange("replays")}
            color={tab === "replays" ? ButtonColor.Black : ButtonColor.White}
            size="small"
          >
            Replays
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {variantOptions && variantOptions.length > 0 && (
            <select
              value={selectedVariantKey || "all"}
              onChange={(e) =>
                onVariantChange(
                  e.target.value === "all" ? null : e.target.value,
                )
              }
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-black focus:outline-none"
              title="Filter by variant"
            >
              <option value="all">All variants</option>
              {variantOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
          )}
          <Button onClick={onRefresh} color={ButtonColor.White} size="small">
            Refresh
          </Button>
          {onReassignSnapshots && (
            <Button
              onClick={onReassignSnapshots}
              color={ButtonColor.White}
              size="small"
            >
              Reassign snapshots
            </Button>
          )}
          <Button
            onClick={onExportCsv}
            disabled={total === 0}
            color={ButtonColor.Black}
            size="small"
          >
            Export CSV
          </Button>
          <Button
            onClick={onExportHtml}
            disabled={responses.length === 0}
            color={ButtonColor.White}
            size="small"
          >
            Export HTML
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FormResponsesHeader;
