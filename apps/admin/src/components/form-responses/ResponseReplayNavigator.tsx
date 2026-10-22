import type {
  ActionWithdrawalDto,
  FormResponseDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import { CirclePlay } from "lucide-react";
import React from "react";
import type { filterDescription } from "../../lib/responseFilter";
import { IdentityChip } from "../IdentitySwatch";
import { WithdrawalInfo } from "../WithdrawalInfo";
import type { RespondentSearch } from "./useRespondentSearch";

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
  const currentResponseVariantName = currentResponse
    ? getResponseVariantName(currentResponse)
    : null;
  const currentWithdrawal =
    currentResponse?.user?.id != null
      ? (withdrawnUserMap.get(currentResponse.user.id) ?? null)
      : null;

  return (
    <div className="px-6 pb-4 border-t border-gray-100 pt-3">
      {filterSummary && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="text-sm text-gray-600">
            Filtered:{" "}
            <span className="font-medium text-gray-900">
              {filterSummary.fieldLabel}
            </span>{" "}
            — {filterSummary.description}{" "}
            <span className="text-gray-400">
              ({filteredTotal} of {total})
            </span>
          </div>
          <Button
            onClick={onClearFilter}
            color={ButtonColor.White}
            size="small"
          >
            Clear filter
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap md:flex-nowrap gap-3">
        <Pagination
          page={page}
          totalPages={Math.max(1, filteredTotal)}
          onPageChange={onPageChange}
        />

        <div className="relative" ref={search.containerRef}>
          <input
            type="text"
            value={search.query}
            onChange={(e) => {
              search.setQuery(e.target.value);
              search.setOpen(true);
            }}
            onFocus={() => search.setOpen(true)}
            onKeyDown={search.handleKeyDown}
            placeholder="Search by name..."
            className="w-56 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-black focus:outline-none"
          />
          {search.open && (
            <div className="absolute z-30 mt-1 w-72 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {search.results.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No matching responses
                </div>
              ) : (
                search.results.map(({ response, idx, name }) => (
                  <button
                    key={response.id ?? `${response.sid}-${idx}`}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-50 last:border-b-0",
                      idx + 1 === page && "bg-blue-50 font-medium",
                    )}
                    onClick={() => search.select(idx)}
                  >
                    <div className="truncate text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(response.createdAt).toLocaleString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {currentResponse && (
          <div className="flex items-center gap-4">
            <div className="text-right min-w-[200px]">
              <div className="flex items-center justify-end gap-2">
                <p className="font-medium text-gray-900 truncate max-w-[700px]">
                  {getRespondentName(currentResponse)}
                </p>
                {currentResponseVariantName && (
                  <IdentityChip
                    seed={currentResponseVariantName}
                    label={currentResponseVariantName}
                  />
                )}
                {currentWithdrawal && (
                  <WithdrawalInfo withdrawal={currentWithdrawal} />
                )}
              </div>
              <p className="text-sm text-gray-500">
                {new Date(currentResponse.createdAt).toLocaleString()}
              </p>
            </div>
            {currentResponse.sessionReplayUrl && (
              <Button
                size="small"
                color={ButtonColor.BlueOutline}
                onClick={() =>
                  window.open(
                    "https://us.posthog.com/project/188181/replay/home?sessionRecordingId=" +
                      currentResponse.sessionReplayUrl!.substring(
                        currentResponse.sessionReplayUrl!.lastIndexOf("/") + 1,
                      ),
                    "_blank",
                  )
                }
              >
                <CirclePlay size={14} className="mr-1.5" />
                Replay
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponseReplayNavigator;
