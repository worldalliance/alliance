import type {
  MmsMediaDto,
  MmsMessageDto,
  MmsThreadEventKind,
} from "@alliance/shared/client/types.gen";
import { type MouseEvent, useEffect, useLayoutEffect, useRef } from "react";
import { getApiUrl } from "../../lib/config";
import { formatDateTime } from "../../lib/formatDate";
import { deliveryStatus } from "../../lib/memberTexts";
import { type TextPage, useOlderTexts } from "../../lib/useOlderTexts";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { EmptyState } from "../../ui/EmptyState";

const NEAR_BOTTOM_PX = 40;

export default function TextHistory({
  thread,
  fetchOlder,
  contactName,
  sentId,
  conflictsShown,
  emptyText,
  className,
}: {
  thread: TextPage;
  fetchOlder: (before: number) => Promise<TextPage>;
  contactName: string;
  sentId: number | undefined;
  /** Counts the composer's conflict warnings, each of which scrolls to the
   * end so the texts it warns about are in view. */
  conflictsShown: number;
  emptyText: string;
  /** The pane's height: fixed in a column of sections, the rest of a pane
   * that fills. */
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const latest = useRef<HTMLDivElement>(null);
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
    // The pane shrinking as the composer grows, or a text resizing as an
    // image fails or a font loads, would otherwise move the reader's place.
    const resized =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(keepPlace);
    resized?.observe(element);
    if (latest.current) resized?.observe(latest.current);
    return () => {
      element.removeEventListener("load", keepPlace, true);
      resized?.disconnect();
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
      className={cn(
        "relative flex flex-col gap-3 overflow-y-auto px-card py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {older.hasOlder && (
        <div className="flex shrink-0 flex-col items-center gap-1">
          <Button
            size="small"
            variant={ButtonVariant.Default}
            onClick={showOlder}
            busy={older.loading}
          >
            Show older texts
          </Button>
          <p role="status" className="min-h-4 text-caption text-danger">
            {older.failed && "Couldn't load older texts."}
          </p>
        </div>
      )}
      {messages.length === 0 && <EmptyState title={emptyText} />}
      {older.history.map((message) => (
        <Message key={message.id} message={message} contactName={contactName} />
      ))}
      {/* Older texts load outside the log, so loading them isn't read out. */}
      <div
        ref={latest}
        role="log"
        aria-label="Latest texts"
        className="flex shrink-0 flex-col gap-3"
      >
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

enum Sender {
  Contact = "contact",
  Staff = "staff",
  Automated = "automated",
}

/** An automated text is outlined, so it differs from a staff text by more
 * than its colour. */
const BUBBLE: Record<Sender, string> = {
  [Sender.Contact]: "rounded-bl-sm border border-line bg-surface-2 text-fg",
  [Sender.Staff]: "rounded-br-sm bg-accent text-accent-fg",
  [Sender.Automated]:
    "rounded-br-sm border border-dashed border-line-strong bg-surface text-fg",
};

function Message({
  message,
  contactName,
}: {
  message: MmsMessageDto;
  contactName: string;
}) {
  const { sender, author, status } = side(message, contactName);
  const outbound = sender !== Sender.Contact;
  return (
    <>
      <div
        data-text-id={message.id}
        className={cn(
          "flex shrink-0 flex-col gap-1",
          outbound ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "flex max-w-3/4 flex-col items-start gap-1 rounded-card px-3 py-2 wrap-break-word whitespace-pre-wrap",
            BUBBLE[sender],
          )}
        >
          {message.body}
          {message.media.map((media) => (
            <Attachment key={media.id} media={media} author={author} />
          ))}
        </div>
        <p
          className={cn(
            "max-w-full text-caption text-fg-muted",
            outbound && "text-right",
          )}
        >
          {author} · {formatDateTime(message.createdAt)}
          {status && (
            <span className={cn(status.failed && "font-medium text-danger")}>
              {" · "}
              {status.label}
              {status.failed && status.reason && `: ${status.reason}`}
            </span>
          )}
        </p>
      </div>
      {message.events.map((event) => (
        <p
          key={event.id}
          className="shrink-0 text-center text-caption text-fg-muted"
        >
          {EVENT_LABEL[event.kind]} by {event.markedByName ?? "Deleted user"} ·{" "}
          {formatDateTime(event.createdAt)}
        </p>
      ))}
    </>
  );
}

function side(message: MmsMessageDto, contactName: string) {
  switch (message.direction) {
    case "outbound":
      return {
        sender: message.sentByStaff ? Sender.Staff : Sender.Automated,
        author: senderLabel(message),
        status: deliveryStatus(message),
      };
    case "inbound":
      return { sender: Sender.Contact, author: contactName, status: null };
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

const senderLabel = (message: MmsMessageDto): string =>
  message.sentByName ?? (message.sentByStaff ? "Deleted user" : "Automated");

function Attachment({ media, author }: { media: MmsMediaDto; author: string }) {
  switch (media.status) {
    case "copying":
      return <p className="text-caption italic">Attachment still loading…</p>;
    case "unavailable":
      return <p className="text-caption italic">Attachment unavailable</p>;
    case "ready":
      break;
    default:
      throw new Error(`unknown media status: ${media.status satisfies never}`);
  }
  const url = `${getApiUrl()}/mms-threads/media/${media.id}`;
  if (media.inline) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-md focus-ring"
      >
        <img
          src={url}
          alt={`Image texted by ${author}`}
          className="max-h-64 rounded-md"
        />
      </a>
    );
  }
  return (
    <a href={url} className="block rounded-sm underline focus-ring">
      Download attachment ({media.contentType})
    </a>
  );
}
