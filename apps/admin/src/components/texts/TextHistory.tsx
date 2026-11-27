import type {
  MmsMediaDto,
  MmsMessageDto,
  MmsThreadEventKind,
} from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { format, isThisYear } from "date-fns";
import { type MouseEvent, useEffect, useLayoutEffect, useRef } from "react";
import { getApiUrl } from "../../lib/config";
import { deliveryStatus } from "../../lib/memberTexts";
import { type TextPage, useOlderTexts } from "../../lib/useOlderTexts";

/** Fixed, so the sections below don't move when the thread arrives. */
export const THREAD_PANE = "h-[28rem]";

const NEAR_BOTTOM_PX = 40;

export default function TextHistory({
  thread,
  fetchOlder,
  contactName,
  sentId,
  conflictsShown,
  emptyText,
}: {
  thread: TextPage;
  fetchOlder: (before: number) => Promise<TextPage>;
  contactName: string;
  sentId: number | undefined;
  /** Counts the composer's conflict warnings, each of which scrolls to the
   * end so the texts it warns about are in view. */
  conflictsShown: number;
  emptyText: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const older = useOlderTexts({ newest: thread, fetchOlder });
  const { messages } = older;
  const sentShown =
    sentId !== undefined && messages.some((text) => text.id === sentId);
  const followedSent = useRef<number>(undefined);
  const followedConflict = useRef(conflictsShown);
  const place = useRef<Place | null>(null);
  const olderHadFocus = useRef(false);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !older.loadedPage) return;
    if (place.current) restorePlace(element, place.current);
    // The last page unmounts the button, which drops its focus to body.
    if (olderHadFocus.current && document.activeElement === document.body)
      element.focus({ preventScroll: true });
    olderHadFocus.current = false;
  }, [older.loadedPage]);

  const showOlder = (event: MouseEvent<HTMLElement>) => {
    if (older.loading) return;
    olderHadFocus.current = document.activeElement === event.currentTarget;
    if (scroller.current) place.current = firstVisible(scroller.current);
    older.loadOlder();
  };

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (sentShown && followedSent.current !== sentId) {
      followedSent.current = sentId;
      atBottom.current = true;
    }
    if (followedConflict.current !== conflictsShown) {
      followedConflict.current = conflictsShown;
      atBottom.current = true;
    }
    if (atBottom.current) element.scrollTop = element.scrollHeight;
  }, [thread, sentId, sentShown, conflictsShown]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const keepPlace = () => {
      if (atBottom.current) element.scrollTop = element.scrollHeight;
      else if (place.current) restorePlace(element, place.current);
    };
    // load doesn't bubble, so the pane listens in the capture phase for its
    // images. WebKit has no scroll anchoring to absorb one loading above.
    element.addEventListener("load", keepPlace, true);
    // A pane mounted hidden has no height to scroll; showing it resizes it
    // from zero.
    const resized = new ResizeObserver(keepPlace);
    resized.observe(element);
    return () => {
      element.removeEventListener("load", keepPlace, true);
      resized.disconnect();
    };
  }, []);

  return (
    <div
      ref={scroller}
      role="region"
      aria-label="Text history"
      tabIndex={0}
      onScroll={(event) => {
        const element = event.currentTarget;
        atBottom.current =
          element.scrollHeight - element.scrollTop - element.clientHeight <
          NEAR_BOTTOM_PX;
        place.current = firstVisible(element);
      }}
      className={cn(THREAD_PANE, "relative overflow-y-auto space-y-2 px-1")}
    >
      {older.hasOlder && (
        <div className="flex items-center justify-center gap-2 py-1">
          <Button
            size="small"
            color={ButtonColor.White}
            onClick={showOlder}
            aria-disabled={older.loading}
          >
            {older.loading ? "Loading older texts…" : "Show older texts"}
          </Button>
          <p role="status" className="text-xs text-red-700">
            {older.failed && "Couldn't load older texts."}
          </p>
        </div>
      )}
      {messages.length === 0 && (
        <p className="text-sm text-zinc-500">{emptyText}</p>
      )}
      {older.history.map((message) => (
        <Message key={message.id} message={message} contactName={contactName} />
      ))}
      {/* Older texts load outside the log, so loading them isn't read out. */}
      <div role="log" aria-label="Latest texts" className="space-y-2">
        {older.latest.map((message) => (
          <Message
            key={message.id}
            message={message}
            contactName={contactName}
          />
        ))}
      </div>
    </div>
  );
}

/** A text's offset from the pane's scroll position. */
type Place = { id: number; offset: number };

const restorePlace = (element: HTMLElement, saved: Place) => {
  const row = element.querySelector<HTMLElement>(
    `[data-text-id="${saved.id}"]`,
  );
  if (row) element.scrollTop = row.offsetTop - saved.offset;
};

const firstVisible = (element: HTMLElement): Place | null => {
  const row = Array.from(
    element.querySelectorAll<HTMLElement>("[data-text-id]"),
  ).find((text) => text.offsetTop + text.offsetHeight > element.scrollTop);
  return row
    ? {
        id: Number(row.dataset.textId),
        offset: row.offsetTop - element.scrollTop,
      }
    : null;
};

function Message({
  message,
  contactName,
}: {
  message: MmsMessageDto;
  contactName: string;
}) {
  const { outbound, author, status } = side(message, contactName);
  return (
    <>
      <div
        data-text-id={message.id}
        className={cn("flex", outbound ? "justify-end" : "justify-start")}
      >
        <div className="max-w-[80%]">
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
              outbound ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900",
            )}
          >
            {message.body}
            {message.media.map((media) => (
              <Attachment key={media.id} media={media} author={author} />
            ))}
          </div>
          <p
            className={cn(
              "mt-0.5 text-xs text-zinc-600",
              outbound && "text-right",
            )}
          >
            {author} · {sentAt(new Date(message.createdAt))}
            {status && (
              <span className={cn(status.failed && "text-red-700 font-medium")}>
                {" · "}
                {status.label}
                {status.failed && status.reason && `: ${status.reason}`}
              </span>
            )}
          </p>
        </div>
      </div>
      {message.events.map((event) => (
        <p key={event.id} className="text-center text-xs text-zinc-600">
          {EVENT_LABEL[event.kind]} by {event.markedByName ?? "Deleted user"} ·{" "}
          {sentAt(new Date(event.createdAt))}
        </p>
      ))}
    </>
  );
}

function side(message: MmsMessageDto, contactName: string) {
  switch (message.direction) {
    case "outbound":
      return {
        outbound: true,
        author: senderLabel(message),
        status: deliveryStatus(message),
      };
    case "inbound":
      return { outbound: false, author: contactName, status: null };
    default:
      throw new Error(
        `unknown direction: ${message.direction satisfies never}`,
      );
  }
}

const EVENT_LABEL: Record<MmsThreadEventKind, string> = {
  marked_handled: "Marked handled",
  marked_needs_reply: "Marked needs reply",
};

const sentAt = (date: Date): string =>
  format(date, isThisYear(date) ? "MMM d, h:mm a" : "MMM d, yyyy, h:mm a");

const senderLabel = (message: MmsMessageDto): string =>
  message.sentByName ?? (message.sentByStaff ? "Deleted user" : "Automated");

function Attachment({ media, author }: { media: MmsMediaDto; author: string }) {
  switch (media.status) {
    case "copying":
      return <p className="mt-1 text-xs italic">Attachment still loading…</p>;
    case "unavailable":
      return <p className="mt-1 text-xs italic">Attachment unavailable</p>;
    case "ready":
      break;
    default:
      throw new Error(`unknown media status: ${media.status satisfies never}`);
  }
  const url = `${getApiUrl()}/mms-threads/media/${media.id}`;
  if (media.inline) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
        <img
          src={url}
          alt={`Image texted by ${author}`}
          className="max-h-64 rounded"
        />
      </a>
    );
  }
  return (
    <a href={url} className="block mt-1 underline">
      Download attachment ({media.contentType})
    </a>
  );
}
