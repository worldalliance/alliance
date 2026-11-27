import { NON_MEMBER_REPLY_WINDOW_DAYS } from "@alliance/common/staffText";
import type { NumberThreadDto } from "@alliance/shared/client/types.gen";
import type { ComponentProps } from "react";
import { useParams } from "react-router";
import TextComposer from "../../components/texts/TextComposer";
import TextThreadSection, {
  ComposerNotice,
  OptedOutNotice,
} from "../../components/texts/TextThreadSection";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { threadContactName } from "../../lib/memberTexts";
import {
  fetchNumberThread,
  useNumberThreadAdmin,
} from "../../lib/useTextThreadsAdmin";
import { ErrorState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";

/**
 * The open thread, in the Inbox's canvas. `InboxPage` is this route's layout,
 * so moving between threads leaves the list where it was.
 */
export default function ThreadPage() {
  const { threadId } = useParams();
  if (!threadId) throw new Error("route has no threadId");
  return <NumberThread key={threadId} threadId={threadId} />;
}

function NumberThread({ threadId }: { threadId: string }) {
  const { thread, send, newestTextId, threadLoadFailed, ...actions } =
    useNumberThreadAdmin(threadId);
  const data = thread.data;
  const contactName = data ? threadContactName(data) : "Text thread";

  if (thread.isError && !data) {
    return (
      <ErrorState
        title="Couldn't load this thread"
        reason={adminRefusalMessage(thread.error, LOAD_FAILED_FALLBACK)}
        onRetry={() => void thread.refetch()}
        retrying={thread.isFetching}
      />
    );
  }
  return (
    <TextThreadSection
      {...actions}
      threadKey={threadId}
      fill
      contactName={contactName}
      thread={thread}
      fetchOlder={(before) => fetchNumberThread({ threadId, before })}
      emptyText="No texts with this number yet."
      composer={(loaded, onConflictShown) => (
        <Composer
          thread={loaded}
          contactName={contactName}
          conflict={{ newestTextId, threadLoadFailed, onConflictShown }}
          send={send}
        />
      )}
    />
  );
}

function Composer({
  thread,
  contactName,
  conflict,
  send,
}: {
  thread: NumberThreadDto;
  contactName: string;
  conflict: Pick<
    ComponentProps<typeof TextComposer>,
    "newestTextId" | "threadLoadFailed" | "onConflictShown"
  >;
  send: (body: string, afterId: number | null) => Promise<unknown>;
}) {
  if (!thread.textable) {
    return (
      <ComposerNotice>
        This number can&apos;t be texted, such as a short code or a sender name.
      </ComposerNotice>
    );
  }
  if (thread.optedOut) {
    return <OptedOutNotice />;
  }
  if (thread.replyWindowClosed) {
    return (
      <ComposerNotice>
        No member has this number and it hasn&apos;t texted in the last{" "}
        {NON_MEMBER_REPLY_WINDOW_DAYS} days, so staff can reply only once it
        texts again.
      </ComposerNotice>
    );
  }
  const [timeZone, ...otherZones] = new Set(
    thread.members.map((member) => member.timeZone),
  );
  return (
    <TextComposer
      recipientName={contactName}
      phoneNumber={thread.phoneNumber}
      timeZone={otherZones.length === 0 ? (timeZone ?? null) : null}
      {...conflict}
      send={send}
    />
  );
}
