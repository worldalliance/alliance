import { href, Link } from "react-router";
import {
  fetchMemberThread,
  useMemberTextsAdmin,
} from "../../lib/useMemberTextsAdmin";
import TextComposer from "../texts/TextComposer";
import TextThreadSection, {
  ComposerNotice,
  OptedOutNotice,
} from "../texts/TextThreadSection";

export default function MemberTextsSection({
  member,
}: {
  member: { id: number; name: string; timeZone: string | null };
}) {
  const { thread, send, ...actions } = useMemberTextsAdmin(member.id);
  const threadId = thread.data?.threadId;

  return (
    <TextThreadSection
      {...actions}
      threadKey={member.id}
      contactName={member.name}
      thread={thread}
      fetchOlder={(before) => fetchMemberThread({ userId: member.id, before })}
      emptyText={
        thread.data?.phoneNumber
          ? "No texts with this member yet."
          : "No phone number on file, so this member can't be texted."
      }
      composer={(data) =>
        !data.phoneNumber ? null : !data.textable ? (
          <ComposerNotice>
            This member&apos;s phone number isn&apos;t valid, so they can&apos;t
            be texted.
          </ComposerNotice>
        ) : data.optedOut ? (
          <OptedOutNotice />
        ) : (
          <TextComposer
            key={member.id}
            recipientName={member.name}
            timeZone={member.timeZone}
            send={send}
          />
        )
      }
      headerLink={
        threadId && (
          <Link
            to={href("/texts/:threadId", { threadId })}
            className="text-sm underline text-zinc-700"
          >
            Open this number&apos;s thread
          </Link>
        )
      }
    />
  );
}
