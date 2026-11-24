import { CATEGORIES } from "@alliance/kora-review/categories";
import { formatDuration, intervalToDuration } from "date-fns";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { formatKoraDate } from "../lib/koraParticipants";
import { useKoraConversationsAdmin } from "../lib/useKoraBatchesAdmin";

const CELL = "px-3 py-2 align-top";
const NUM = `${CELL} text-right tabular-nums`;

const label = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

const duration = (ms: number | null) =>
  ms === null
    ? "—"
    : formatDuration(intervalToDuration({ start: 0, end: ms }), {
        format: ["hours", "minutes", "seconds"],
      }) || "0 seconds";

function ConversationList() {
  const conversations = useKoraConversationsAdmin();
  if (conversations.isPending) {
    return <p className="text-sm">Loading conversations…</p>;
  }
  if (conversations.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {adminRefusalMessage(
          conversations.error,
          "Couldn't load the conversations. Reload to try again.",
        )}
      </p>
    );
  }
  if (conversations.data.length === 0) {
    return <p className="text-sm text-zinc-600">No conversations yet.</p>;
  }
  return (
    <table className="text-sm">
      <thead className="text-left text-zinc-500">
        <tr>
          <th className={CELL}>Conversation</th>
          <th className={CELL}>Category</th>
          <th className={CELL}>Uploaded</th>
          <th className={`${CELL} text-right`}>Reviews</th>
          <th className={`${CELL} text-right`}>Median time</th>
          <th className={`${CELL} text-right`}>Fastest</th>
          <th className={`${CELL} text-right`}>Slowest</th>
        </tr>
      </thead>
      <tbody>
        {conversations.data.map((c) => (
          <tr key={c.id} className="border-t border-zinc-200">
            <td className={`${CELL} font-mono`}>{c.id}</td>
            <td className={CELL}>{label(c.category)}</td>
            <td className={`${CELL} whitespace-nowrap`}>
              {formatKoraDate(c.uploadedAt)}
            </td>
            <td className={NUM}>
              {c.reviews} of {c.reviewsPerTranscript}
            </td>
            <td className={NUM}>{duration(c.medianTimeMs)}</td>
            <td className={NUM}>{duration(c.minTimeMs)}</td>
            <td className={NUM}>{duration(c.maxTimeMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function KoraConversations() {
  return (
    <section aria-labelledby="kora-conversations" className="space-y-3">
      <h2 id="kora-conversations" className="font-semibold">
        Conversations
      </h2>
      <p className="text-sm text-zinc-600">
        Every uploaded conversation, newest batch first. Reviews counts finished
        reviews against the batch&apos;s target. Times are how long finished
        reviews had the conversation open while the page was visible.
      </p>
      <ConversationList />
    </section>
  );
}
