import type { ReplyState } from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ToastVariant, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import type { TextPage } from "../../lib/useOlderTexts";
import {
  SectionLoadState,
  SectionRefreshError,
} from "../user-detail/SectionQueryState";
import TextHistory, { THREAD_PANE } from "./TextHistory";

type Thread = TextPage & {
  textable: boolean;
  optedOut: boolean;
  replyState: ReplyState;
};

export default function TextThreadSection<T extends Thread>(props: {
  threadKey: string | number;
  contactName: string;
  thread: { data: T | undefined; isError: boolean; isRefetchError: boolean };
  fetchOlder: (before: number) => Promise<TextPage>;
  sentId: number | undefined;
  emptyText: string;
  markOptedOut: () => Promise<unknown>;
  markingOptedOut: boolean;
  markHandled: (throughId: number) => Promise<unknown>;
  markNeedsReply: (throughId: number) => Promise<unknown>;
  markingHandled: boolean;
  markingNeedsReply: boolean;
  composer: (thread: T) => ReactNode;
}) {
  const { threadKey, contactName, thread, markingOptedOut } = props;
  const { confirm, showToast } = useToast();
  const optedOutShown = Boolean(
    thread.data?.phoneNumber && thread.data.optedOut,
  );
  const optedOutBadge = useRef<HTMLSpanElement>(null);
  const focusBadgeFor = useRef<string | number | null>(null);

  useEffect(() => {
    if (focusBadgeFor.current !== threadKey) focusBadgeFor.current = null;
    if (focusBadgeFor.current === null || !optedOutShown) return;
    focusBadgeFor.current = null;
    if (document.activeElement === document.body)
      optedOutBadge.current?.focus();
  }, [threadKey, optedOutShown]);

  const handleMarkOptedOut = async (event: MouseEvent<HTMLElement>) => {
    const confirmed = await confirm({
      anchorEl: event.currentTarget,
      title: "Mark as opted out?",
      message: `Use this when ${contactName} asked in their own words to stop getting texts. They will get no texts from the Alliance, automated or from staff, until they text START. Anyone else with this phone number is opted out too.`,
      confirmLabel: "Mark opted out",
    });
    if (!confirmed) return;
    focusBadgeFor.current = threadKey;
    try {
      await props.markOptedOut();
    } catch (thrown) {
      if (focusBadgeFor.current === threadKey) focusBadgeFor.current = null;
      showToast({
        variant: ToastVariant.Error,
        title: `Problem marking ${contactName} opted out`,
        message: adminRefusalMessage(thrown, "Try again."),
        durationMs: null,
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
    try {
      await (handledControl.handled ? props.markNeedsReply : props.markHandled)(
        latest.id,
      );
    } catch (thrown) {
      showToast({
        variant: ToastVariant.Error,
        title: handledControl.handled
          ? `Problem marking ${contactName}'s texts as needing a reply`
          : `Problem marking ${contactName}'s texts handled`,
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
        <div className="flex items-center gap-2">
          {handledControl && (
            <Button
              size="small"
              color={ButtonColor.White}
              onClick={handleReplyControl}
              aria-disabled={handledControl.pending}
            >
              {handledControl.label}
            </Button>
          )}
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
      </div>
      {thread.data ? (
        <>
          <TextHistory
            key={threadKey}
            thread={thread.data}
            fetchOlder={props.fetchOlder}
            contactName={contactName}
            sentId={props.sentId}
            emptyText={props.emptyText}
          />
          <div className={COMPOSER_AREA}>{props.composer(thread.data)}</div>
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

const replyControl = (params: {
  thread: Thread | undefined;
  markingHandled: boolean;
  markingNeedsReply: boolean;
}) => {
  const { thread, markingHandled, markingNeedsReply } = params;
  if (!thread || thread.optedOut) return null;
  switch (thread.replyState) {
    case "needs_reply":
      return {
        handled: false,
        pending: markingHandled,
        label: markingHandled ? "Marking handled…" : "Mark handled",
      };
    case "handled":
      return {
        handled: true,
        pending: markingNeedsReply,
        label: markingNeedsReply ? "Marking needs reply…" : "Mark needs reply",
      };
    case "answered":
      return null;
    default:
      throw new Error(
        `unknown reply state: ${thread.replyState satisfies never}`,
      );
  }
};

export function OptedOutNotice() {
  return (
    <ComposerNotice>
      This number opted out of texts. It can opt back in by texting START.
    </ComposerNotice>
  );
}

export function ComposerNotice({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}

/** The small Button's height, so the header doesn't grow when its controls
 * arrive. */
const HEADER_HEIGHT = "min-h-[2.125rem]";

/** Reserves the idle composer's height (two-row box, two-line hint), so the
 * sections below don't move when the thread arrives. */
const COMPOSER_AREA = "mt-3 min-h-[10.75rem]";
