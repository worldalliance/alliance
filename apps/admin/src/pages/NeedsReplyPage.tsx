import type { NeedsReplyThreadDto } from "@alliance/shared/client/types.gen";
import { useClockMinute } from "@alliance/shared/lib/useClockMinute";
import { cn } from "@alliance/shared/styles/util";
import { formatDistanceToNow } from "date-fns";
import {
  type FocusEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { href, Link } from "react-router";
import ComposingNotice from "../components/texts/ComposingNotice";
import { SectionRefreshError } from "../components/user-detail/SectionQueryState";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { textPreview, threadContactName } from "../lib/memberTexts";
import { useNeedsReplyAdmin } from "../lib/useTextThreadsAdmin";

type Row = { thread: NeedsReplyThreadDto; left: boolean };

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

const nextRows = (params: {
  shown: Row[];
  threads: NeedsReplyThreadDto[];
  held: boolean;
}): Row[] => {
  const { shown, threads, held } = params;
  if (!held) return threads.map((thread) => ({ thread, left: false }));
  const latest = new Map(threads.map((t) => [t.threadId, t]));
  const kept = shown.map((row): Row => {
    const thread = latest.get(row.thread.threadId);
    return thread ? { thread, left: false } : { ...row, left: true };
  });
  const keptIds = new Set(shown.map((row) => row.thread.threadId));
  return [
    ...kept,
    ...threads
      .filter((t) => !keptIds.has(t.threadId))
      .map((thread) => ({ thread, left: false })),
  ];
};

/** So a poll never moves the row about to be clicked. */
function useHeldRows(threads: NeedsReplyThreadDto[] | undefined) {
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const hidden = useSyncExternalStore(
    subscribeToVisibility,
    () => document.hidden,
  );
  const held = (pointerIn || focusIn) && !hidden;
  const [shown, setShown] = useState<{
    threads?: NeedsReplyThreadDto[];
    held: boolean;
    rows: Row[];
  }>({ held: false, rows: [] });
  let rows = shown.rows;
  if (threads && (shown.threads !== threads || shown.held !== held)) {
    rows = nextRows({ shown: shown.rows, threads, held });
    setShown({ threads, held, rows });
  }
  const list = useRef<HTMLDivElement>(null);
  // React fires no blur for a focused row that unmounts, and every unmount
  // changes rows.
  useLayoutEffect(() => {
    if (focusIn && !list.current?.contains(document.activeElement)) {
      setFocusIn(false);
    }
  }, [focusIn, rows]);
  const listProps = {
    ref: list,
    onPointerEnter: () => setPointerIn(true),
    onPointerLeave: () => setPointerIn(false),
    onFocus: (e: FocusEvent) => setFocusIn(e.target.matches(":focus-visible")),
    onBlur: (e: FocusEvent) => {
      const to = e.relatedTarget;
      if (!(to instanceof Node && e.currentTarget.contains(to))) {
        setFocusIn(false);
      }
    },
  };
  return { rows, listProps };
}

const NeedsReplyPage = () => {
  const {
    data: threads,
    isError,
    isRefetchError,
    error,
  } = useNeedsReplyAdmin();
  const { rows, listProps } = useHeldRows(threads);
  useClockMinute();

  return (
    <div className="flex flex-col gap-4 p-5">
      <title>Needs reply - Admin</title>
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold">Needs reply</h1>
          <p role="status" className="text-sm text-zinc-600">
            {threads &&
              (threads.length > 0
                ? `${threads.length} waiting`
                : "None waiting")}
          </p>
          <SectionRefreshError
            noun="texts needing a reply"
            isError={isRefetchError}
            className="mb-0"
          />
        </div>
        <p className="text-sm text-zinc-600">
          Phone numbers with a text no staff member has answered yet, members or
          not, longest waiting first. A number leaves the list once someone
          replies, marks its texts handled, or it opts out of texts. It comes
          back if that reply fails to send, if it texts again, or if someone
          marks it needs reply.
        </p>
      </div>
      <div {...listProps}>
        {!threads ? (
          isError ? (
            <p role="alert" className="text-sm text-red-600">
              {adminRefusalMessage(
                error,
                "Couldn't load texts needing a reply.",
              )}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Loading texts…</p>
          )
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No texts are waiting for a reply.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 border border-zinc-200 rounded">
            {rows.map(({ thread, left }) => (
              <li key={thread.threadId}>
                <Link
                  to={href("/inbox/:threadId", { threadId: thread.threadId })}
                  className="flex flex-col gap-0.5 px-3 py-2 hover:bg-zinc-50"
                >
                  <div className="flex justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span
                        className={cn("font-medium", left && "text-zinc-500")}
                      >
                        {threadContactName(thread)}
                      </span>
                      <ComposingNotice
                        phoneNumber={thread.phoneNumber}
                        announce={false}
                        className="truncate"
                      />
                    </div>
                    <span
                      className={cn("shrink-0 text-zinc-600", left && "italic")}
                    >
                      {left
                        ? "No longer waiting"
                        : `Waiting ${formatDistanceToNow(new Date(thread.waitingSince))}`}
                    </span>
                  </div>
                  <span className="truncate text-sm text-zinc-600">
                    {textPreview(thread.lastMessageBody)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NeedsReplyPage;
