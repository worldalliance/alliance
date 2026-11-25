import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import { NON_MEMBER_REPLY_WINDOW_DAYS } from "@alliance/common/staffText";
import type { NumberThreadDto } from "@alliance/shared/client/types.gen";
import type { ComponentProps } from "react";
import { href, Link, useParams } from "react-router";
import TextComposer from "../components/texts/TextComposer";
import TextThreadSection, {
  ComposerNotice,
  OptedOutNotice,
} from "../components/texts/TextThreadSection";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { threadContactName } from "../lib/memberTexts";
import {
  fetchNumberThread,
  useNumberThreadAdmin,
} from "../lib/useTextThreadsAdmin";

export default function TextThreadPage() {
  const { threadId } = useParams();
  if (!threadId) throw new Error("route has no threadId");
  return <NumberThread key={threadId} threadId={threadId} />;
}

function NumberThread({ threadId }: { threadId: string }) {
  const { thread, send, newestTextId, threadLoadFailed, ...actions } =
    useNumberThreadAdmin(threadId);
  const data = thread.data;
  const contactName = data ? threadContactName(data) : "Text thread";

  return (
    <div className="flex grow flex-col gap-4 p-5 max-w-3xl">
      <title>{`${contactName} - Texts - Admin`}</title>
      <Link
        to={"/inbox?tab=all"}
        className="text-sm underline text-zinc-700 self-start"
      >
        All texts
      </Link>
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-xl font-semibold">{contactName}</h1>
        <div className="min-h-5">{data && <ThreadPeople thread={data} />}</div>
      </div>
      {thread.isError && !data ? (
        <p role="alert" className="text-sm text-red-600">
          {adminRefusalMessage(thread.error, "Couldn't load this thread.")}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-clip rounded-card border border-line">
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
        </div>
      )}
    </div>
  );
}

function ThreadPeople({ thread }: { thread: NumberThreadDto }) {
  const number = formatPhoneNumberForDisplay(thread.phoneNumber);
  if (thread.members.length === 0) {
    return (
      <p className="text-sm text-zinc-600">No member has this phone number.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-x-3 text-sm text-zinc-600">
      <li>{number}</li>
      {thread.members.map((member) => (
        <li key={member.id}>
          <Link
            to={href("/members/:userId", { userId: String(member.id) })}
            className="underline text-zinc-800"
          >
            {member.name}&apos;s member page
          </Link>
        </li>
      ))}
    </ul>
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
