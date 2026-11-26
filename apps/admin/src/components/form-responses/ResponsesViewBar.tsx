import type { FormResponseDto } from "@alliance/shared/client";
import { ChevronDown, Download, RefreshCw } from "lucide-react";
import React, { useMemo } from "react";
import { formatDate } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import Button, { ButtonVariant, buttonVariants } from "../../ui/Button";
import { cn } from "../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { Select } from "../../ui/Select";
import { ViewSwitch } from "../../ui/templates/List";
import type { ResponseVariantOption } from "../FormResponsesView";

export enum ResponsesTab {
  Responses = "responses",
  Stats = "stats",
  Questions = "questions",
  Replays = "replays",
}

const TAB_LABELS: Record<ResponsesTab, string> = {
  [ResponsesTab.Responses]: "Responses",
  [ResponsesTab.Stats]: "Stats",
  [ResponsesTab.Questions]: "Questions",
  [ResponsesTab.Replays]: "Replays",
};

const TAB_ITEMS = Object.values(ResponsesTab).map((id) => ({
  id,
  label: TAB_LABELS[id],
}));

export const isTab = (value: string | null): value is ResponsesTab =>
  Object.values(ResponsesTab).some((tab) => tab === value);

const ALL_VARIANTS = "all";

const smallDefault = cn(
  "inline-flex",
  buttonVariants({ variant: ButtonVariant.Default, size: "small" }),
);

type ResponsesViewBarProps = {
  /** Every response, unscoped by variant. */
  responses: FormResponseDto[];
  /** Responses in the selected variant. */
  total: number;
  loading: boolean;
  error: string | null;
  tab: ResponsesTab;
  onTabChange: (tab: ResponsesTab) => void;
  variantOptions?: ResponseVariantOption[];
  selectedVariantKey: string;
  onVariantChange: (key: string | null) => void;
  onRefresh: () => void;
  /** Offers "Reassign snapshots" when present. */
  onReassignSnapshots?: () => void;
  onExportCsv: () => void;
  onExportHtml: () => void;
};

/**
 * The responses view's own bar, inside the record tab that hosts it: which
 * view of the responses, which variant, the facts about them, and what acts
 * on all of them.
 */
const ResponsesViewBar: React.FC<ResponsesViewBarProps> = ({
  responses,
  total,
  loading,
  error,
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
  // Every response, so the date doesn't move with the variant or a search.
  const firstResponseAt = useMemo(
    () =>
      responses.reduce<string | null>(
        (oldest, response) =>
          oldest === null || response.createdAt < oldest
            ? response.createdAt
            : oldest,
        null,
      ),
    [responses],
  );
  const variantPicked = selectedVariantKey !== "";

  return (
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-page py-bar">
      <ViewSwitch
        label="Responses view"
        items={TAB_ITEMS}
        value={tab}
        onChange={onTabChange}
      />
      {variantOptions && variantOptions.length > 0 && (
        <Select
          aria-label="Variant"
          value={selectedVariantKey || ALL_VARIANTS}
          onChange={(event) =>
            onVariantChange(
              event.target.value === ALL_VARIANTS ? null : event.target.value,
            )
          }
          className="h-control-sm w-48"
        >
          <option value={ALL_VARIANTS}>All variants</option>
          {variantOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </Select>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="mr-1 text-fg-muted tabular-nums">
          {loading || error !== null
            ? "—"
            : `${countOf(total, "response")}${firstResponseAt ? ` · first ${formatDate(firstResponseAt)}` : ""}`}
        </span>
        <Button
          variant={ButtonVariant.Default}
          size="small"
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className={smallDefault}>
            <Download aria-hidden="true" className="size-4" />
            Export
            <ChevronDown aria-hidden="true" className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem disabled={total === 0} onClick={onExportCsv}>
              <span className="flex flex-col">
                Export CSV
                <span className="text-caption text-fg-muted">
                  {variantPicked ? "The variant picked" : "Every response"}
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={responses.length === 0}
              onClick={onExportHtml}
            >
              <span className="flex flex-col">
                Export HTML
                <span className="text-caption text-fg-muted">
                  Every response
                  {variantOptions && variantOptions.length > 0
                    ? ", by variant"
                    : ""}
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onReassignSnapshots && (
          <Button
            variant={ButtonVariant.Default}
            size="small"
            onClick={onReassignSnapshots}
          >
            Reassign snapshots
          </Button>
        )}
      </div>
    </div>
  );
};

export default ResponsesViewBar;
