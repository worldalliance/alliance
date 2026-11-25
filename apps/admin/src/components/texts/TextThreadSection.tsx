import type { ReplyState } from "@alliance/shared/client/types.gen";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import type { TextPage } from "../../lib/useOlderTexts";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { ContentState } from "../../ui/templates/States";
import { ToastVariant, useToast } from "../../ui/ToastProvider";
import TextHistory from "./TextHistory";

type Thread = TextPage & {
  textable: boolean;
  optedOut: boolean;
  replyState: ReplyState;
};

type Failure = { title: string; message: string; threadKey: string | number };

/**
 * One phone number's conversation: its marks in a header strip, the history,
 * and the composer or the reason there is none. In a column of sections it is
 * a card of a fixed height.
 */
export default function TextThreadSection<T extends Thread>(props: {
  threadKey: string | number;
  contactName: string;
  thread: {
    data: T | undefined;
    isPending: boolean;
    isLoadingError: boolean;
    isRefetchError: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  fetchOlder: (before: number) => Promise<TextPage>;
  sentId: number | undefined;
  emptyText: string;
  markOptedOut: () => Promise<unknown>;
  markingOptedOut: boolean;
  markHandled: (throughId: number) => Promise<unknown>;
  markNeedsReply: (throughId: number) => Promise<unknown>;
  markingHandled: boolean;
  markingNeedsReply: boolean;
  /** `onConflictShown` scrolls the thread to its end, so the texts a send
   * refusal warns about are in view. */
  composer: (thread: T, onConflictShown: () => void) => ReactNode;
  /** Beside the heading: a link, or a fact about the number. */
  headerLink?: ReactNode;
}) {
  const { threadKey, contactName, thread, markingOptedOut } = props;
  const { confirm, showToast } = useToast();
  const headingId = useId();
  const optedOutShown = Boolean(
    thread.data?.phoneNumber && thread.data.optedOut,
  );
  const optedOutBadge = useRef<HTMLSpanElement>(null);
  const focusBadgeFor = useRef<string | number | null>(null);
  const [conflictsShown, setConflictsShown] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const leftThread = useRef<AbortController>(null);

  // Aborts when the pane moves on to another number or unmounts, closing a
  // question about this one, declined.
  useEffect(() => {
    const controller = new AbortController();
    leftThread.current = controller;
    return () => controller.abort();
  }, [threadKey]);

  useEffect(() => {
    if (focusBadgeFor.current !== threadKey) focusBadgeFor.current = null;
    if (focusBadgeFor.current === null || !optedOutShown) return;
    focusBadgeFor.current = null;
    if (document.activeElement === document.body)
      optedOutBadge.current?.focus();
  }, [threadKey, optedOutShown]);

  // A failed mark shows in its conversation while that is on screen, and as a
  // toast that stays once the reader has left it.
  const reportFailure = (params: {
    title: string;
    thrown: unknown;
    left: AbortSignal | undefined;
  }) => {
    const { title, left } = params;
    const message = adminRefusalMessage(params.thrown, "Try again.");
    if (left && !left.aborted) setFailure({ title, message, threadKey });
    else
      showToast({
        variant: ToastVariant.Error,
        title,
        message,
        durationMs: null,
      });
  };

  const handleMarkOptedOut = async () => {
    const left = leftThread.current?.signal;
    const confirmed = await confirm({
      title: "Mark as opted out?",
      message: `Use this when ${contactName} asked in their own words to stop getting texts. They will get no texts from the Alliance, automated or from staff, until they text START. Anyone else with this phone number is opted out too.`,
      confirmLabel: "Mark opted out",
      signal: left,
    });
    if (!confirmed) return;
    focusBadgeFor.current = threadKey;
    setFailure(null);
    try {
      await props.markOptedOut();
    } catch (thrown) {
      if (focusBadgeFor.current === threadKey) focusBadgeFor.current = null;
      reportFailure({
        title: `Problem marking ${contactName} opted out`,
        thrown,
        left,
      });
    }
  };

  const handledControl = replyControl({
    thread: thread.data,
    markingHandled: props.markingHandled,
    markingNeedsReply: props.markingNeedsReply,
  });

  const handleReplyControl = async () => {
    const latest = thread.data?.messages.at(-1);
    if (!handledControl || handledControl.pending || !latest) return;
    const left = leftThread.current?.signal;
    setFailure(null);
    try {
      await (handledControl.handled ? props.markNeedsReply : props.markHandled)(
        latest.id,
      );
    } catch (thrown) {
      reportFailure({
        title: handledControl.handled
          ? `Problem marking ${contactName}'s texts as needing a reply`
          : `Problem marking ${contactName}'s texts handled`,
        thrown,
        left,
      });
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col rounded-card border border-line bg-surface"
    >
      <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line px-card py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
          <h2 id={headingId} className="truncate font-semibold">
            Texts
          </h2>
          {props.headerLink}
          {/* Mounted while empty, so screen readers announce it when it fills. */}
          <p role="status" className="text-caption font-medium text-danger">
            {thread.isRefetchError && "Couldn't refresh texts."}
          </p>
          {thread.isRefetchError && (
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              onClick={() => void thread.refetch()}
              busy={thread.isFetching}
            >
              Try again
            </Button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {handledControl && (
            <Button
              size="small"
              variant={ButtonVariant.Default}
              onClick={() => void handleReplyControl()}
              busy={handledControl.pending}
            >
              {handledControl.label}
            </Button>
          )}
          {optedOutShown ? (
            <span
              ref={optedOutBadge}
              tabIndex={-1}
              className="flex rounded-full focus-ring"
            >
              <Badge tone={BadgeTone.Danger}>Opted out</Badge>
            </span>
          ) : (
            thread.data?.textable && (
              <Button
                size="small"
                variant={ButtonVariant.Default}
                onClick={() => void handleMarkOptedOut()}
                busy={markingOptedOut}
              >
                Mark opted out
              </Button>
            )
          )}
        </div>
      </div>
      {failure?.threadKey === threadKey && (
        <div className="shrink-0 px-card pt-3">
          <Banner
            tone={BannerTone.Danger}
            inline
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
            <p className="font-medium">{failure.title}</p>
            <p>{failure.message}</p>
          </Banner>
        </div>
      )}
      {thread.data ? (
        <>
          <TextHistory
            key={threadKey}
            thread={thread.data}
            fetchOlder={props.fetchOlder}
            contactName={contactName}
            sentId={props.sentId}
            conflictsShown={conflictsShown}
            emptyText={props.emptyText}
            className={HISTORY_SIZE}
          />
          <div className={cn(COMPOSER_AREA, COMPOSER_HEIGHT)}>
            {props.composer(thread.data, () =>
              setConflictsShown((count) => count + 1),
            )}
          </div>
        </>
      ) : (
        <>
          <div className={cn(HISTORY_SIZE, "overflow-hidden")}>
            <ContentState
              things="texts"
              query={thread}
              refreshBanner={false}
              skeleton={<HistorySkeleton />}
            >
              {null}
            </ContentState>
          </div>
          <div className={cn(COMPOSER_AREA, COMPOSER_HEIGHT)} />
        </>
      )}
    </section>
  );
}

const replyControl = (params: {
  thread: Thread | undefined;
  markingHandled: boolean;
  markingNeedsReply: boolean;
}) => {
  const { thread, markingHandled, markingNeedsReply } = params;
  if (!thread || thread.optedOut) return null;
  switch (thread.replyState) {
    case "needs_reply":
      return { handled: false, pending: markingHandled, label: "Mark handled" };
    case "handled":
      return {
        handled: true,
        pending: markingNeedsReply,
        label: "Mark needs reply",
      };
    case "answered":
      return null;
    default:
      throw new Error(
        `unknown reply state: ${thread.replyState satisfies never}`,
      );
  }
};

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3 px-card py-4">
      <Skeleton className="h-14 w-3/5 rounded-card" />
      <Skeleton className="h-9 w-2/5 self-end rounded-card" />
      <Skeleton className="h-9 w-1/2 rounded-card" />
    </div>
  );
}

export function OptedOutNotice() {
  return (
    <ComposerNotice>
      This number opted out of texts. It can opt back in by texting START.
    </ComposerNotice>
  );
}

/** Why there is no composer, in the composer's place. */
export function ComposerNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-line bg-surface-2 px-3 py-2.5 text-fg-muted">
      {children}
    </p>
  );
}

const HISTORY_SIZE = "h-112 shrink-0";

const COMPOSER_AREA = "shrink-0 px-card pt-1 pb-4";

/** The idle composer's height, held in a column of sections and while the
 * thread loads, so what is below doesn't move when the composer arrives. */
const COMPOSER_HEIGHT = "min-h-52";
