import { withCount } from "@alliance/common/plural";
import { waitlistAdminSearchEntriesAdmin } from "@alliance/shared/client";
import type {
  WaitlistEntryFilterDto,
  WaitlistEntrySort,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import WaitlistFilters from "../components/waitlist/WaitlistFilters";
import WaitlistTable from "../components/waitlist/WaitlistTable";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { isOrganization } from "../lib/isOrganization";
import {
  campaignsLoadFailed,
  campaignsQuery,
  waitlistLinksLoadFailed,
  waitlistLinksQuery,
} from "../lib/waitlistAdminQueries";
import { withFilterField } from "../lib/waitlistFilter";

const PAGE_SIZE = 50;

const WaitlistPage: React.FC = () => {
  const [filter, setFilter] = useState<WaitlistEntryFilterDto>({});
  const [sort, setSort] = useState<WaitlistEntrySort>("joined_desc");
  const [page, setPage] = useState(1);

  const changeFilter = useCallback((next: WaitlistEntryFilterDto) => {
    setFilter(next);
    setPage(1);
  }, []);

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

  const organizations = useMemo(
    () => (campaigns.data ?? []).filter(isOrganization),
    [campaigns.data],
  );

  const total = entries.data?.total ?? 0;
  const loadError =
    (entries.error &&
      adminRefusalMessage(entries.error, "Unable to load the waitlist.")) ||
    (campaigns.error &&
      adminRefusalMessage(campaigns.error, campaignsLoadFailed)) ||
    (links.error && adminRefusalMessage(links.error, waitlistLinksLoadFailed));

  return (
    <div className="p-5 space-y-4">
      <title>Waitlist - Admin</title>
      <h1 className="text-lg font-bold text-zinc-900">Waitlist</h1>

      <WaitlistFilters
        filter={filter}
        onChange={changeFilter}
        organizations={organizations}
        links={links.data ?? []}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-700">
        <span>
          {entries.data
            ? withCount(total, "entry")
            : entries.isPending && "Loading…"}
        </span>
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
        <Pagination
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default WaitlistPage;
