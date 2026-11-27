import { useClockMinute } from "@alliance/shared/lib/useClockMinute";
import { formatDistanceToNow } from "date-fns";
import { formatCount } from "../../lib/formatNumber";
import { textPreview, threadContactName } from "../../lib/memberTexts";
import { useNeedsReplyAdmin } from "../../lib/useTextThreadsAdmin";
import { InfoTip } from "../../ui/InfoTip";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import {
  QueueBar,
  ThreadRow,
  ThreadRowsSkeleton,
  useOpenRowInView,
} from "./ThreadRow";
import { useHeldRows } from "./useHeldRows";

export function NeedsReplyTab() {
  const needsReply = useNeedsReplyAdmin();
  const threads = needsReply.data;
  const { rows, listProps } = useHeldRows(threads);
  useOpenRowInView(listProps.ref, rows.length > 0);
  useClockMinute();

  return (
    <>
      <QueueBar>
        <p role="status" className="flex-1 text-fg-muted tabular-nums">
          {threads &&
            (threads.length > 0
              ? `${formatCount(threads.length)} waiting`
              : "None waiting")}
        </p>
        <InfoTip label="About Needs reply">
          Phone numbers with a text no staff member has answered yet, members or
          not, longest waiting first. A number leaves the list once someone
          replies, marks its texts handled, or it opts out of texts. It comes
          back if that reply fails to send, if it texts again, or if someone
          marks it needs reply.
        </InfoTip>
      </QueueBar>
      <RefreshFailedBanner
        inline
        things="texts needing a reply"
        query={needsReply}
      />
      <div {...listProps} className="min-h-0 flex-1 overflow-y-auto">
        <ContentState
          things="texts needing a reply"
          query={needsReply}
          refreshBanner={false}
          skeleton={<ThreadRowsSkeleton />}
          empty={rows.length === 0}
          emptyTitle="No texts are waiting for a reply"
        >
          <ul aria-label="Needs reply">
            {rows.map(({ thread, left }) => (
              <ThreadRow
                key={thread.threadId}
                threadId={thread.threadId}
                phoneNumber={thread.phoneNumber}
                name={threadContactName(thread)}
                when={
                  left
                    ? "No longer waiting"
                    : `Waiting ${formatDistanceToNow(new Date(thread.waitingSince))}`
                }
                preview={textPreview(thread.lastMessageBody)}
                left={left}
              />
            ))}
          </ul>
        </ContentState>
      </div>
    </>
  );
}
