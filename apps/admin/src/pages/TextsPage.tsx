import {
  formatPhoneNumberForDisplay,
  phoneSearchTerm,
} from "@alliance/common/phone";
import { THREAD_SEARCH_MAX_LENGTH } from "@alliance/common/staffText";
import type { ThreadSummaryDto } from "@alliance/shared/client/types.gen";
import { useClockMinute } from "@alliance/shared/lib/useClockMinute";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { format, isThisYear, isToday } from "date-fns";
import { useId } from "react";
import { Form, href, Link, useSearchParams } from "react-router";
import { SectionRefreshError } from "../components/user-detail/SectionQueryState";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { textPreview, threadContactName } from "../lib/memberTexts";
import { useTextThreadListAdmin } from "../lib/useTextThreadsAdmin";

export default function TextsPage() {
  const [params] = useSearchParams();
  const search = params.get("search") ?? "";
  const pageNumber = Math.max(
    1,
    Number.parseInt(params.get("page") ?? "", 10) || 1,
  );
  const searchable = search === "" || phoneSearchTerm(search) !== "";
  const list = useTextThreadListAdmin(
    { page: pageNumber, search },
    { enabled: searchable },
  );
  const searchId = useId();
  useClockMinute();
  const older = list.data?.hasMore && !list.isPlaceholderData;

  const pageLink = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `?${next}`;
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <title>Texts - Admin</title>
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold">Texts</h1>
          <SectionRefreshError
            noun="texts"
            isError={list.isRefetchError}
            className="mb-0"
          />
          <p role="status" className="text-sm text-zinc-500">
            {list.isPlaceholderData ? "Loading texts…" : ""}
          </p>
        </div>
        <p className="text-sm text-zinc-600">
          Every phone number that has texted the Alliance or had a text from
          staff, members or not, latest text first.
        </p>
      </div>
      <Form role="search" className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={searchId} className="text-xs text-zinc-600">
            Phone number
          </label>
          <input
            id={searchId}
            name="search"
            type="search"
            inputMode="tel"
            defaultValue={search}
            maxLength={THREAD_SEARCH_MAX_LENGTH}
            key={search}
            className="text-sm border border-zinc-300 rounded px-3 py-1.5 w-64"
          />
        </div>
        <Button type="submit" size="small" color={ButtonColor.Stone}>
          Search
        </Button>
      </Form>
      {!searchable ? (
        <p role="alert" className="text-sm text-red-600">
          Search by the digits of a phone number.
        </p>
      ) : !list.data ? (
        list.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {adminRefusalMessage(list.error, "Couldn't load texts.")}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">Loading texts…</p>
        )
      ) : list.data.threads.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {pageNumber > 1
            ? "No more texts."
            : search
              ? "No phone number matches that search."
              : "No texts yet."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 border border-zinc-200 rounded">
          {list.data.threads.map((thread) => (
            <li key={thread.threadId}>
              <ThreadRow thread={thread} />
            </li>
          ))}
        </ul>
      )}
      {searchable && (pageNumber > 1 || older) && (
        <nav aria-label="Pages" className="flex gap-3 text-sm">
          {pageNumber > 1 && (
            <Link to={pageLink(pageNumber - 1)} className="underline">
              Newer texts
            </Link>
          )}
          {older && (
            <Link to={pageLink(pageNumber + 1)} className="underline">
              Older texts
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function ThreadRow({ thread }: { thread: ThreadSummaryDto }) {
  const at = new Date(thread.lastMessageAt);
  return (
    <Link
      to={href("/texts/:threadId", { threadId: thread.threadId })}
      className="flex flex-col gap-0.5 px-3 py-2 hover:bg-zinc-50"
    >
      <span className="flex justify-between gap-2 text-sm">
        <span className="font-medium">
          {threadContactName(thread)}
          {thread.members.length > 0 && (
            <span className="font-normal text-zinc-600">
              {" · "}
              {formatPhoneNumberForDisplay(thread.phoneNumber)}
            </span>
          )}
        </span>
        <span className="text-zinc-600 shrink-0">
          {format(
            at,
            isToday(at) ? "h:mm a" : isThisYear(at) ? "MMM d" : "MMM d, yyyy",
          )}
        </span>
      </span>
      <span className="truncate text-sm text-zinc-600">
        {PREVIEW_PREFIX[thread.lastMessageDirection]}
        {textPreview(thread.lastMessageBody)}
      </span>
    </Link>
  );
}

const PREVIEW_PREFIX: Record<ThreadSummaryDto["lastMessageDirection"], string> =
  { inbound: "", outbound: "Staff: " };
