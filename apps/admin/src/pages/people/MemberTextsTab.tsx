import { href, Link } from "react-router";
import TextComposer from "../../components/texts/TextComposer";
import TextThreadSection, {
  ComposerNotice,
  OptedOutNotice,
} from "../../components/texts/TextThreadSection";
import {
  fetchMemberThread,
  useMemberTextsAdmin,
} from "../../lib/useMemberTextsAdmin";
import { linkClass } from "../../ui/styles";

/** The member's own text thread, in the inbox's thread view. */
export function MemberTextsTab({
  member,
}: {
  member: { id: number; name: string; timeZone: string | null };
}) {
  const { thread, send, newestTextId, threadLoadFailed, ...actions } =
    useMemberTextsAdmin(member.id);
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
      composer={(data, onConflictShown) =>
        !data.phoneNumber ? null : !data.textable ? (
          <ComposerNotice>
            This member's phone number isn't valid, so they can't be texted.
          </ComposerNotice>
        ) : data.optedOut ? (
          <OptedOutNotice />
        ) : (
          <TextComposer
            key={member.id}
            recipientName={member.name}
            phoneNumber={data.phoneNumber}
            timeZone={member.timeZone}
            newestTextId={newestTextId}
            threadLoadFailed={threadLoadFailed}
            onConflictShown={onConflictShown}
            send={send}
          />
        )
      }
      headerLink={
        threadId && (
          <Link to={href("/inbox/:threadId", { threadId })} className={linkClass}>
            Open this number's thread
          </Link>
        )
      }
    />
  );
}
