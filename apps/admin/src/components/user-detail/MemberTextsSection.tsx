import type {
  MmsMediaDto,
  MmsMessageDto,
  MmsThreadDto,
} from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ToastVariant, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { format, isThisYear } from "date-fns";
import { type MouseEvent, useEffect, useLayoutEffect, useRef } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { getApiUrl } from "../../lib/config";
import { deliveryStatus } from "../../lib/memberTexts";
import { useMemberTextsAdmin } from "../../lib/useMemberTextsAdmin";
import { useOlderMemberTexts } from "../../lib/useOlderMemberTexts";
import { SectionLoadState, SectionRefreshError } from "./SectionQueryState";
import TextComposer from "./TextComposer";

export default function MemberTextsSection({
  member,
}: {
  member: { id: number; name: string; timeZone: string | null };
}) {
  const { thread, send, markOptedOut, markingOptedOut } = useMemberTextsAdmin(
    member.id,
  );
  const { confirm, showToast } = useToast();
  const optedOutShown = Boolean(
    thread.data?.phoneNumber && thread.data.optedOut,
  );
  const optedOutBadge = useRef<HTMLSpanElement>(null);
  const focusBadgeFor = useRef<number | null>(null);

  useEffect(() => {
    if (focusBadgeFor.current !== member.id) focusBadgeFor.current = null;
    if (focusBadgeFor.current === null || !optedOutShown) return;
    focusBadgeFor.current = null;
    if (document.activeElement === document.body)
      optedOutBadge.current?.focus();
  }, [member.id, optedOutShown]);

  const handleMarkOptedOut = async (event: MouseEvent<HTMLElement>) => {
    const confirmed = await confirm({
      anchorEl: event.currentTarget,
      title: "Mark as opted out?",
      message: `Use this when ${member.name} asked in their own words to stop getting texts. They will get no texts from the Alliance, automated or from staff, until they text START. Anyone else with this phone number is opted out too.`,
      confirmLabel: "Mark opted out",
    });
    if (!confirmed) return;
    focusBadgeFor.current = member.id;
    try {
      await markOptedOut.mutateAsync(member.id);
    } catch (thrown) {
      if (focusBadgeFor.current === member.id) focusBadgeFor.current = null;
      showToast({
        variant: ToastVariant.Error,
        title: `Problem marking ${member.name} opted out`,
        message: adminRefusalMessage(thrown, "Try again."),
        durationMs: null,
      });
    }
  };

  return (
    <section className="border border-zinc-200 rounded p-3">
      <div
        className={cn(
          "flex items-center justify-between mx-1 mb-2 gap-2",
          HEADER_HEIGHT,
        )}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-700">Texts</h2>
          <SectionRefreshError
            noun="texts"
            isError={thread.isRefetchError}
            className="mb-0"
          />
        </div>
        {optedOutShown ? (
          <span
            ref={optedOutBadge}
            tabIndex={-1}
            className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800"
          >
            Opted out
          </span>
        ) : (
          thread.data?.textable && (
            <Button
              size="small"
              color={ButtonColor.White}
              onClick={handleMarkOptedOut}
              disabled={markingOptedOut}
            >
              {markingOptedOut ? "Marking opted out…" : "Mark opted out"}
            </Button>
          )
        )}
      </div>
      {thread.data ? (
        <>
          <Thread
            key={member.id}
            userId={member.id}
            thread={thread.data}
            memberName={member.name}
            sentId={send.data?.id}
          />
          <div className={COMPOSER_AREA}>
            {!thread.data.phoneNumber ? null : !thread.data.textable ? (
              <p className="text-sm text-zinc-500">
                This member&apos;s phone number isn&apos;t valid, so they
                can&apos;t be texted.
              </p>
            ) : thread.data.optedOut ? (
              <p className="text-sm text-zinc-500">
                {member.name} opted out of texts. They can opt back in by
                texting START.
              </p>
            ) : (
              <TextComposer
                key={member.id}
                memberName={member.name}
                timeZone={member.timeZone}
                send={(body) => send.mutateAsync({ userId: member.id, body })}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className={THREAD_PANE}>
            <SectionLoadState noun="texts" isError={thread.isError} />
          </div>
          <div className={COMPOSER_AREA} />
        </>
      )}
    </section>
  );
}

/** The small Button's height, so the header doesn't grow when the opt-out
 * control arrives. */
const HEADER_HEIGHT = "min-h-[2.125rem]";

/** The thread pane keeps its size and the composer area reserves the idle
 * composer's height (two-row box, two-line hint), so the sections below
 * don't move when the thread arrives. */
const THREAD_PANE = "h-[28rem]";
const COMPOSER_AREA = "mt-3 min-h-[10.75rem]";

const NEAR_BOTTOM_PX = 40;

function Thread({
  userId,
  thread,
  memberName,
  sentId,
}: {
  userId: number;
  thread: MmsThreadDto;
  memberName: string;
  sentId: number | undefined;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const older = useOlderMemberTexts(userId, thread);
  const { messages } = older;
  const sentShown =
    sentId !== undefined && messages.some((text) => text.id === sentId);
  const followedSent = useRef<number>(undefined);
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
    if (atBottom.current) element.scrollTop = element.scrollHeight;
  }, [thread, sentId, sentShown]);

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
    return () => element.removeEventListener("load", keepPlace, true);
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
        <p className="text-sm text-zinc-500">
          {thread.phoneNumber
            ? "No texts with this member yet."
            : "No phone number on file, so this member can't be texted."}
        </p>
      )}
      {older.history.map((message) => (
        <Message key={message.id} message={message} memberName={memberName} />
      ))}
      {/* Older texts load outside the log, so loading them isn't read out. */}
      <div role="log" aria-label="Latest texts" className="space-y-2">
        {older.latest.map((message) => (
          <Message key={message.id} message={message} memberName={memberName} />
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
  memberName,
}: {
  message: MmsMessageDto;
  memberName: string;
}) {
  const { outbound, author, status } = side(message, memberName);
  return (
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
  );
}

function side(message: MmsMessageDto, memberName: string) {
  switch (message.direction) {
    case "outbound":
      return {
        outbound: true,
        author: senderLabel(message),
        status: deliveryStatus(message),
      };
    case "inbound":
      return { outbound: false, author: memberName, status: null };
    default:
      throw new Error(
        `unknown direction: ${message.direction satisfies never}`,
      );
  }
}

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
