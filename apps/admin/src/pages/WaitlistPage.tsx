import { pickForCount, withCount } from "@alliance/common/plural";
import {
  waitlistAdminFindEntryIdsAdmin,
  waitlistAdminSearchEntriesAdmin,
} from "@alliance/shared/client";
import type {
  WaitlistEntryFilterDto,
  WaitlistEntrySort,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CohortControls from "../components/waitlist/CohortControls";
import MobilizeActions from "../components/waitlist/MobilizeActions";
import TagActions from "../components/waitlist/TagActions";
import TagManager from "../components/waitlist/TagManager";
import WaitlistFilters from "../components/waitlist/WaitlistFilters";
import WaitlistTable from "../components/waitlist/WaitlistTable";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { isOrganization } from "../lib/isOrganization";
import { useRefusalToast } from "../lib/useRefusalToast";
import {
  campaignsLoadFailed,
  campaignsQuery,
  waitlistCohortsQuery,
  waitlistLinksLoadFailed,
  waitlistLinksQuery,
  waitlistTagsQuery,
} from "../lib/waitlistAdminQueries";
import { withFilterField } from "../lib/waitlistFilter";

const PAGE_SIZE = 50;

const WaitlistPage: React.FC = () => {
  const refusalToast = useRefusalToast();
  const [filter, setFilter] = useState<WaitlistEntryFilterDto>({});
  const [sort, setSort] = useState<WaitlistEntrySort>("joined_desc");
  const [page, setPage] = useState(1);
  // Remounting the filters on a cohort drops a search still being typed.
  const [filtersKey, setFiltersKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectionVersion = useRef(0);

  const changeSelection = useCallback((next: Set<number>) => {
    selectionVersion.current += 1;
    setSelectedIds(next);
  }, []);

  const changeFilter = useCallback(
    (next: WaitlistEntryFilterDto) => {
      setFilter(next);
      setPage(1);
      changeSelection(new Set());
    },
    [changeSelection],
  );

  const searchDto = {
    filter,
    sort,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  };
  const entries = useQuery({
    queryKey: queryKeys.waitlistEntriesAdmin(searchDto),
    queryFn: () =>
      waitlistAdminSearchEntriesAdmin({
        body: searchDto,
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const campaigns = useQuery(campaignsQuery);
  const links = useQuery(waitlistLinksQuery);
  const tags = useQuery(waitlistTagsQuery);
  const cohorts = useQuery(waitlistCohortsQuery);

  const organizations = useMemo(
    () => campaigns.data?.filter(isOrganization),
    [campaigns.data],
  );

  const selectAllMatching = useMutation({
    mutationFn: (params: {
      matching: WaitlistEntryFilterDto;
      version: number;
    }) =>
      waitlistAdminFindEntryIdsAdmin({
        body: { filter: params.matching },
        throwOnError: true,
      }).then((r) => r.data.ids),
    onSuccess: (ids, { version }) => {
      if (version === selectionVersion.current) changeSelection(new Set(ids));
    },
    onError: (err) => refusalToast(err, "Could not select every entry."),
  });

  const total = entries.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (entries.data && page > lastPage) setPage(lastPage);
  }, [entries.data, page, lastPage]);
  const loadError =
    (entries.error &&
      adminRefusalMessage(entries.error, "Unable to load the waitlist.")) ||
    (campaigns.error &&
      adminRefusalMessage(campaigns.error, campaignsLoadFailed)) ||
    (links.error &&
      adminRefusalMessage(links.error, waitlistLinksLoadFailed)) ||
    (tags.error && adminRefusalMessage(tags.error, "Unable to load tags.")) ||
    (cohorts.error &&
      adminRefusalMessage(cohorts.error, "Unable to load cohorts."));

  return (
    <div className="p-5 space-y-4">
      <title>Waitlist - Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-zinc-900">Waitlist</h1>
        <CohortControls
          cohorts={cohorts.data ?? []}
          filter={filter}
          onApply={(next) => {
            setFiltersKey((key) => key + 1);
            changeFilter(next);
          }}
        />
      </div>

      <WaitlistFilters
        key={filtersKey}
        filter={filter}
        onChange={changeFilter}
        organizations={organizations}
        links={links.data}
        tags={tags.data}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-700">
        <span>
          {entries.data
            ? withCount(total, "entry")
            : entries.isPending && "Loading…"}
        </span>
        {selectedIds.size > 0 && (
          <span className="font-medium">
            {withCount(selectedIds.size, "entry")}{" "}
            {pickForCount(selectedIds.size, "is", "are")} selected
          </span>
        )}
        {total > 0 && selectedIds.size < total && (
          <button
            type="button"
            className="text-blue-600 hover:underline disabled:opacity-50"
            disabled={selectAllMatching.isPending || entries.isPlaceholderData}
            onClick={() =>
              selectAllMatching.mutate({
                matching: filter,
                version: selectionVersion.current,
              })
            }
          >
            Select all {total} matching
          </button>
        )}
        {selectedIds.size > 0 && (
          <button
            type="button"
            aria-label="Clear selection"
            title="Clear selection"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            onClick={() => changeSelection(new Set())}
          >
            <X size={16} />
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <TagActions
            selectedIds={selectedIds}
            tags={tags.data ?? []}
            onChanged={() => changeSelection(new Set())}
          />
          <TagManager tags={tags.data} />
          <MobilizeActions
            selectedIds={selectedIds}
            onChanged={() => changeSelection(new Set())}
          />
        </div>
      </div>

      {loadError && <p className="text-sm text-red-500">{loadError}</p>}

      {entries.data &&
        (entries.data.entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No entries match.</p>
        ) : (
          <div
            className={cn(
              "border border-zinc-200 rounded-lg bg-white overflow-hidden",
              entries.isPlaceholderData && "opacity-60",
            )}
          >
            <WaitlistTable
              entries={entries.data.entries}
              selectedIds={selectedIds}
              onSelectedIdsChange={changeSelection}
              selectable={!entries.isPlaceholderData}
              sort={sort}
              onSortChange={(next) => {
                setSort(next);
                setPage(1);
              }}
              onFilterReferrer={(id) =>
                changeFilter(
                  withFilterField({ filter, key: "referrerIds", value: [id] }),
                )
              }
            />
          </div>
        ))}

      {total > PAGE_SIZE && (
        <Pagination page={page} totalPages={lastPage} onPageChange={setPage} />
      )}
    </div>
  );
};

export default WaitlistPage;
