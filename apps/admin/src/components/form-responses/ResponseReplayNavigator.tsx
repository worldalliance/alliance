import type {
  ActionWithdrawalDto,
  FormResponseDto,
} from "@alliance/shared/client";
import { CirclePlay } from "lucide-react";
import React from "react";
import { formatDateTime } from "../../lib/formatDate";
import { countOf, formatCount } from "../../lib/formatNumber";
import { posthogReplayHref } from "../../lib/posthogReplay";
import type { filterDescription } from "../../lib/responseFilter";
import { ButtonVariant, buttonVariants } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Combobox, type ComboboxOption } from "../../ui/Combobox";
import NewTabMark from "../../ui/NewTabMark";
import Pagination from "../../ui/Pagination";
import { FilterBar, FilterChip, listCount } from "../../ui/templates/List";
import { IdentityChip } from "../IdentitySwatch";
import { WithdrawalBadge, WithdrawalDetails } from "../WithdrawalInfo";
import {
  RESPONDENT_RESULT_LIMIT,
  type RespondentSearch,
} from "./useRespondentSearch";

const CHIP_FIELD_LENGTH = 32;

const shorten = (text: string): string =>
  text.length > CHIP_FIELD_LENGTH
    ? `${text.slice(0, CHIP_FIELD_LENGTH - 1)}…`
    : text;

type ResponseReplayNavigatorProps = {
  filterSummary: ReturnType<typeof filterDescription>;
  filteredTotal: number;
  total: number;
  onClearFilter: () => void;
  page: number;
  onPageChange: (page: number) => void;
  search: RespondentSearch;
  currentResponse: FormResponseDto | undefined;
  getRespondentName: (response: FormResponseDto) => string;
  getResponseVariantName: (response: FormResponseDto) => string | null;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
};

/** Ends the list when the search matches more than it shows; picking it does nothing. */
const MORE = -1;

function RespondentCombobox({
  search,
  page,
}: {
  search: RespondentSearch;
  page: number;
}) {
  const shown = search.results.slice(0, RESPONDENT_RESULT_LIMIT);
  const hidden = search.results.length - shown.length;
  const options: ComboboxOption<number>[] = shown.map(
    ({ response, idx, name }) => {
      const submitted = formatDateTime(response.createdAt);
      return {
        value: idx,
        label: name,
        detail: idx + 1 === page ? `Showing · ${submitted}` : submitted,
      };
    },
  );
  if (hidden > 0) {
    options.push({
      value: MORE,
      label: `${formatCount(hidden)} more. Type a name to narrow the list.`,
    });
  }
  return (
    <div className="w-80">
      <Combobox
        aria-label="Find a respondent"
        placeholder="Find a respondent"
        className="h-control-sm"
        options={options}
        value={null}
        onChange={(idx) => {
          if (idx !== MORE) search.select(idx);
        }}
        query={search.query}
        onQueryChange={search.setQuery}
        emptyText="No matching responses"
      />
    </div>
  );
}

const ResponseReplayNavigator: React.FC<ResponseReplayNavigatorProps> = ({
  filterSummary,
  filteredTotal,
  total,
  onClearFilter,
  page,
  onPageChange,
  search,
  currentResponse,
  getRespondentName,
  getResponseVariantName,
  withdrawnUserMap,
}) => {
  const variantName = currentResponse
    ? getResponseVariantName(currentResponse)
    : null;
  const withdrawal =
    currentResponse?.user?.id != null
      ? (withdrawnUserMap.get(currentResponse.user.id) ?? null)
      : null;
  const recording = currentResponse?.sessionReplayUrl;

  return (
    <div className="bg-surface">
      <FilterBar
        count={
          filterSummary
            ? listCount({ shown: filteredTotal, total, noun: "response" })
            : countOf(filteredTotal, "response")
        }
        actions={
          <Pagination
            page={page}
            totalPages={Math.max(1, filteredTotal)}
            onPageChange={onPageChange}
            siblingCount={0}
          />
        }
      >
        <RespondentCombobox search={search} page={page} />
        {filterSummary && (
          <span
            title={`${filterSummary.fieldLabel}: ${filterSummary.description}`}
          >
            <FilterChip
              field={shorten(filterSummary.fieldLabel)}
              value={shorten(filterSummary.description)}
              onRemove={onClearFilter}
            />
          </span>
        )}
      </FilterBar>
      {currentResponse && (
        <div className="flex min-h-14 items-center gap-3 border-b border-line px-page py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="max-w-full truncate text-heading font-semibold">
              {getRespondentName(currentResponse)}
            </h2>
            {variantName && (
              <IdentityChip seed={variantName} label={variantName} />
            )}
            {withdrawal && (
              <span className="flex min-w-0 items-center gap-2">
                <WithdrawalBadge />
                <WithdrawalDetails withdrawal={withdrawal} />
              </span>
            )}
            <span className="text-fg-muted">
              Submitted {formatDateTime(currentResponse.createdAt)}
            </span>
          </div>
          {recording && (
            <a
              href={posthogReplayHref(recording)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex shrink-0",
                buttonVariants({
                  variant: ButtonVariant.Default,
                  size: "small",
                }),
              )}
            >
              <CirclePlay aria-hidden="true" className="size-4" />
              Watch session recording
              <NewTabMark />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default ResponseReplayNavigator;
