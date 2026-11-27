import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "react-router";
import ComposingNotice from "../../components/texts/ComposingNotice";
import { threadHref } from "../../lib/hrefs";
import { cn } from "../../ui/cn";
import { Skeleton } from "../../ui/Skeleton";

/**
 * One phone number in a queue, linking to its thread with the queue's search
 * params kept, so opening it leaves the list as it was. The open thread's row
 * is marked.
 */
export function ThreadRow({
  threadId,
  phoneNumber,
  name,
  when,
  preview,
  left = false,
}: {
  threadId: string;
  phoneNumber: string;
  name: string;
  when: string;
  preview: string;
  /** No longer in the queue, kept in place while the list is held. */
  left?: boolean;
}) {
  const { search } = useLocation();
  const open = useParams().threadId === threadId;
  return (
    <li>
      <Link
        to={{ pathname: threadHref(threadId), search }}
        aria-current={open ? "page" : undefined}
        // Inset, since the scrolling pane would clip an outline outside the row.
        className="flex flex-col gap-0.5 border-b border-line px-card py-3 transition-colors duration-fast not-aria-[current=page]:hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:bg-accent-soft"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 truncate font-medium",
              left && "text-fg-muted",
            )}
          >
            {name}
          </span>
          <ComposingNotice
            phoneNumber={phoneNumber}
            announce={false}
            className="self-center"
          />
        </span>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-fg-muted">
            {preview}
          </span>
          <span className="shrink-0 text-caption text-fg-muted tabular-nums">
            {when}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Under a queue's tabs: its search or its count, one height on both. */
export function QueueBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line px-card py-bar">
      {children}
    </div>
  );
}

export function QueueFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-2 border-t border-line px-card py-bar">
      {children}
    </div>
  );
}

/** Rows in the shape of `ThreadRow`, for a queue's first load. */
export function ThreadRowsSkeleton() {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <li
          key={index}
          className="flex flex-col gap-0.5 border-b border-line px-card py-3"
        >
          <span className="flex h-lh items-center">
            <Skeleton className="h-3.5 w-2/3" />
          </span>
          <span className="flex h-lh items-center">
            <Skeleton className="h-3.5 w-full" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Scrolls the open thread's row into view once the list first lands, so a
 * reload or a return from another page shows it. Later updates leave the
 * reader's scroll alone.
 */
export function useOpenRowInView(
  list: RefObject<HTMLElement | null>,
  landed: boolean,
) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !landed) return;
    done.current = true;
    list.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [list, landed]);
}
