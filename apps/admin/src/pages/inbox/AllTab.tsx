import {
  formatPhoneNumberForDisplay,
  phoneSearchTerm,
} from "@alliance/common/phone";
import { THREAD_SEARCH_MAX_LENGTH } from "@alliance/common/staffText";
import type { ThreadSummaryDto } from "@alliance/shared/client/types.gen";
import { useClockMinute } from "@alliance/shared/lib/useClockMinute";
import { isToday } from "date-fns";
import { useLayoutEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router";
import { formatDate, formatTime } from "../../lib/formatDate";
import { textPreview, threadContactName } from "../../lib/memberTexts";
import { useTextThreadListAdmin } from "../../lib/useTextThreadsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { SearchField } from "../../ui/templates/List";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import {
  QueueBar,
  QueueFooter,
  ThreadRow,
  ThreadRowsSkeleton,
  useOpenRowInView,
} from "./ThreadRow";

const PREVIEW_PREFIX: Record<ThreadSummaryDto["lastMessageDirection"], string> =
  { inbound: "", outbound: "Staff: " };

const rowName = (thread: ThreadSummaryDto) =>
  thread.members.length > 0
    ? `${threadContactName(thread)} · ${formatPhoneNumberForDisplay(thread.phoneNumber)}`
    : threadContactName(thread);

const lastTextTime = (at: Date) =>
  isToday(at) ? formatTime(at) : formatDate(at);

/** Every number texted or texting, latest first, searched by its digits on the server and paged there. */
export function AllTab() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const pageNumber = Math.max(
    1,
    Number.parseInt(params.get("page") ?? "", 10) || 1,
  );
  // `maxLength` stops a longer search being typed, but not one in the URL.
  const tooLong = search.length > THREAD_SEARCH_MAX_LENGTH;
  const searchable =
    search === "" || (!tooLong && phoneSearchTerm(search) !== "");
  const list = useTextThreadListAdmin(
    { page: pageNumber, search },
    { enabled: searchable },
  );
  useClockMinute();
  const rowsRef = useRef<HTMLDivElement>(null);
  useOpenRowInView(rowsRef, Boolean(list.data?.threads.length));
  useLayoutEffect(() => {
    if (rowsRef.current) rowsRef.current.scrollTop = 0;
  }, [pageNumber]);
  const older = list.data?.hasMore && !list.isPlaceholderData;

  const setSearch = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  const pageLink = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `${pathname}?${next}`;
  };

  return (
    <>
      <QueueBar>
        <SearchField
          label="Search by phone number"
          value={search}
          onChange={setSearch}
          inputMode="tel"
          maxLength={THREAD_SEARCH_MAX_LENGTH}
          className="w-full"
        />
      </QueueBar>
      <RefreshFailedBanner inline things="texts" query={list} />
      <div ref={rowsRef} className="min-h-0 flex-1 overflow-y-auto">
        {!searchable ? (
          <InlineError
            className="px-card py-3"
            message={
              tooLong
                ? `Search by at most ${THREAD_SEARCH_MAX_LENGTH} characters.`
                : "Search by the digits of a phone number."
            }
          />
        ) : (
          <ContentState
            things="texts"
            query={list}
            refreshBanner={false}
            skeleton={<ThreadRowsSkeleton />}
            empty={list.data?.threads.length === 0}
            filtered={search !== "" && pageNumber === 1}
            onClearFilters={() => setSearch("")}
            emptyTitle={pageNumber > 1 ? "No more texts" : "No texts yet"}
          >
            <ul
              aria-label="All"
              aria-busy={list.isPlaceholderData}
              className="transition-opacity duration-base aria-busy:opacity-60"
            >
              {list.data?.threads.map((thread) => (
                <ThreadRow
                  key={thread.threadId}
                  threadId={thread.threadId}
                  phoneNumber={thread.phoneNumber}
                  name={rowName(thread)}
                  when={lastTextTime(new Date(thread.lastMessageAt))}
                  preview={`${PREVIEW_PREFIX[thread.lastMessageDirection]}${textPreview(thread.lastMessageBody)}`}
                />
              ))}
            </ul>
          </ContentState>
        )}
      </div>
      {searchable && (pageNumber > 1 || older) && (
        <QueueFooter>
          <nav aria-label="Pages" className="contents">
            {pageNumber > 1 && (
              <Button
                size="small"
                variant={ButtonVariant.Default}
                to={pageLink(pageNumber - 1)}
              >
                Newer texts
              </Button>
            )}
            <p role="status" className="text-caption text-fg-muted">
              {list.isPlaceholderData ? "Loading texts…" : ""}
            </p>
            {older && (
              <Button
                size="small"
                variant={ButtonVariant.Default}
                to={pageLink(pageNumber + 1)}
                className="ml-auto"
              >
                Older texts
              </Button>
            )}
          </nav>
        </QueueFooter>
      )}
    </>
  );
}
