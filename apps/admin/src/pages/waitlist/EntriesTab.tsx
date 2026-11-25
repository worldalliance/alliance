import type { AdminWaitlistEntryDto } from "@alliance/shared/client/types.gen";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf, formatCount } from "../../lib/formatNumber";
import { isOrganization } from "../../lib/isOrganization";
import { useCampaignsAdmin } from "../../lib/useCampaignsAdmin";
import { useWaitlistCohortsAdmin } from "../../lib/useWaitlistCohortsAdmin";
import {
  useFindWaitlistEntryIdsAdmin,
  useWaitlistEntriesAdmin,
} from "../../lib/useWaitlistEntriesAdmin";
import { useWaitlistLinksAdmin } from "../../lib/useWaitlistLinksAdmin";
import { useWaitlistTagsAdmin } from "../../lib/useWaitlistTagsAdmin";
import type { EmailDraft } from "../../lib/waitlistEmail";
import {
  INITIAL_WAITLIST_FILTER,
  sameFilter,
  withFilterField,
} from "../../lib/waitlistFilter";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import Pagination from "../../ui/Pagination";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import {
  BulkBar,
  FilterBar,
  ListContent,
  ListFooter,
  listCount,
} from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { BulkActions } from "./BulkActions";
import { EmailComposer } from "./EmailComposer";
import { ENTRY_COLUMNS, EntriesTable } from "./EntriesTable";
import { EntryFilters } from "./EntryFilters";
import { EntryDialog, filterKeeps } from "./EntryRowActions";
import { InvitationDialog, ReferralLinkDialog } from "./LinkDialogs";
import { MetricsPanel } from "./MetricsPanel";
import { useEntryListState } from "./useEntryListState";
import { useEntrySelection } from "./useEntrySelection";
import { useRevealWhenOpened } from "./useRevealWhenOpened";

const PAGE_SIZE = 50;

/** A part of the tab that failed to load, and what that leaves out. */
function PartFailed({
  things,
  error,
  meaning,
}: {
  things: string;
  error: unknown;
  meaning: string;
}) {
  return (
    <Banner tone={BannerTone.Danger}>
      Couldn't load {things}. {adminRefusalMessage(error, LOAD_FAILED_FALLBACK)}{" "}
      {meaning}
    </Banner>
  );
}

export function EntriesTab({
  draft,
  onDraftChange,
  onCloseComposer,
  showMetrics,
}: {
  /** The email being written, or null while the composer is closed. */
  draft: EmailDraft | null;
  onDraftChange: (draft: EmailDraft) => void;
  onCloseComposer: () => void;
  showMetrics: boolean;
}) {
  const list = useEntryListState();
  const { filter, sort, page } = list;
  const entries = useWaitlistEntriesAdmin({
    filter,
    sort,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });
  const campaigns = useCampaignsAdmin();
  const links = useWaitlistLinksAdmin();
  const tags = useWaitlistTagsAdmin();
  const cohorts = useWaitlistCohortsAdmin();
  const organizations = useMemo(
    () => campaigns.data?.filter(isOrganization),
    [campaigns.data],
  );
  const selection = useEntrySelection(JSON.stringify(filter));
  const [failure, setFailure] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    entry: AdminWaitlistEntryDto;
    kind: EntryDialog;
  } | null>(null);

  const selectAll = useFindWaitlistEntryIdsAdmin({
    onError: (err) =>
      setFailure(
        adminRefusalMessage(err, "Couldn't select every matching entry."),
      ),
  });

  const total = entries.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const { setPage } = list;
  useEffect(() => {
    if (entries.data && page > lastPage) setPage(lastPage);
  }, [entries.data, page, lastPage, setPage]);

  const filtered = !sameFilter(filter, INITIAL_WAITLIST_FILTER);
  const rows = entries.data?.entries ?? [];
  const searchRef = useRef<{ focus: () => void }>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  useRevealWhenOpened({
    open: draft !== null,
    panel: composerRef,
    focus: subjectRef,
  });
  useRevealWhenOpened({ open: showMetrics, panel: metricsRef });
  const focus = useFocusAfterRemoval({
    ids: rows.map((entry) => entry.id),
    fallback: searchRef,
  });
  const first = (page - 1) * PAGE_SIZE + 1;

  const dialogs: Record<
    EntryDialog,
    (entry: AdminWaitlistEntryDto) => ReactNode
  > = {
    [EntryDialog.Invitation]: (entry) => (
      <InvitationDialog entry={entry} onClose={() => setDialog(null)} />
    ),
    [EntryDialog.Referral]: (entry) => (
      <ReferralLinkDialog entry={entry} onClose={() => setDialog(null)} />
    ),
  };

  return (
    <>
      {failure && (
        <Banner
          tone={BannerTone.Danger}
          action={
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              onClick={() => setFailure(null)}
            >
              Dismiss
            </Button>
          }
        >
          {failure}
        </Banner>
      )}
      {campaigns.isLoadingError && (
        <PartFailed
          things="organizations"
          error={campaigns.error}
          meaning="The Organization and Link filters can't name them until they load."
        />
      )}
      {links.isLoadingError && (
        <PartFailed
          things="waitlist links"
          error={links.error}
          meaning="The Link filter is empty until they load."
        />
      )}
      {tags.isLoadingError && (
        <PartFailed
          things="tags"
          error={tags.error}
          meaning="The Tag filter, Remove tag and Manage tags wait until they load, and Add tag can only make a new tag."
        />
      )}
      {cohorts.isLoadingError && (
        <PartFailed
          things="cohorts"
          error={cohorts.error}
          meaning="Saved cohorts can't be applied until they load."
        />
      )}
      <RefreshFailedBanner things="the waitlist" query={entries} />
      <FilterBar
        count={listCount({ total, noun: "entry" })}
        actions={
          total > 0 &&
          selection.selected.size < total && (
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              disabled={selectAll.isPending || entries.isPlaceholderData}
              onClick={() => {
                const stamp = selection.stamp();
                selectAll.mutate(filter, {
                  onSuccess: (ids) => {
                    if (selection.isCurrent(stamp)) {
                      selection.change(new Set(ids));
                    }
                  },
                });
              }}
            >
              Select all {formatCount(total)} matching
            </Button>
          )
        }
      >
        <EntryFilters
          searchRef={searchRef}
          filter={filter}
          onChange={list.setFilter}
          cohorts={cohorts.data}
          cohortId={list.cohortId}
          onApplyCohort={list.applyCohort}
          organizations={organizations}
          links={links.data}
          tags={tags.data}
          onFailure={setFailure}
        />
      </FilterBar>
      <ListContent>
        {(draft || showMetrics) && (
          <div className="flex flex-col gap-section border-b border-line bg-canvas px-page py-section">
            {draft && (
              <EmailComposer
                ref={composerRef}
                subjectRef={subjectRef}
                selectedIds={selection.selected}
                draft={draft}
                onDraftChange={onDraftChange}
                onClose={onCloseComposer}
                onSent={() => {
                  onCloseComposer();
                  selection.clear();
                }}
              />
            )}
            {showMetrics && (
              <div ref={metricsRef}>
                <MetricsPanel filter={filter} />
              </div>
            )}
          </div>
        )}
        <ContentState
          things="the waitlist"
          query={entries}
          refreshBanner={false}
          skeleton={<TableSkeleton bleed columns={ENTRY_COLUMNS} />}
          empty={rows.length === 0}
          filtered={filtered}
          onClearFilters={() => list.setFilter(INITIAL_WAITLIST_FILTER)}
          emptyTitle="No entries yet"
          emptyDescription="Entries marked or suspected as spam are hidden by the Spam filter."
        >
          <div
            aria-busy={entries.isPlaceholderData || undefined}
            className={cn(
              "transition-opacity duration-base",
              entries.isPlaceholderData && "opacity-60",
            )}
          >
            <EntriesTable
              entries={rows}
              selected={selection.selected}
              onSelectedChange={selection.change}
              selectable={!entries.isPlaceholderData}
              sort={sort}
              onSortChange={list.setSort}
              onFilterReferrer={(id) =>
                list.setFilter(
                  withFilterField({ filter, key: "referrerIds", value: [id] }),
                )
              }
              onOpen={(entry, kind) => setDialog({ entry, kind })}
              onSpamChanged={selection.deselect}
              onWriting={(id, after) =>
                filterKeeps(filter, after) ? () => {} : focus.removing(id)
              }
              focusRow={focus.row}
              onFailure={setFailure}
            />
          </div>
        </ContentState>
      </ListContent>
      {total > PAGE_SIZE && (
        <ListFooter>
          <span className="tabular-nums">
            {formatCount(first)}–
            {formatCount(Math.min(first + rows.length - 1, total))} of{" "}
            {countOf(total, "entry")}
          </span>
          <Pagination
            page={page}
            totalPages={lastPage}
            onPageChange={setPage}
          />
        </ListFooter>
      )}
      {dialog && dialogs[dialog.kind](dialog.entry)}
      <BulkBar count={selection.selected.size} onClear={selection.clear}>
        <BulkActions
          selected={selection.selected}
          tags={tags.data ?? []}
          onChanged={selection.clear}
          onFailure={setFailure}
        />
      </BulkBar>
    </>
  );
}
