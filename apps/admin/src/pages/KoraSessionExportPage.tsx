import { Link, useParams } from "react-router";
import { z } from "zod";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { formatKoraDate } from "../lib/koraParticipants";
import { useKoraSessionExport } from "../lib/useKoraBatchesAdmin";

const CELL = "px-3 py-2 align-top";

const ratingsSchema = z.object({
  ratings: z.array(
    z.looseObject({
      conversationId: z.string(),
      status: z.string(),
      kind: z.string().optional(),
    }),
  ),
});

export default function KoraSessionExportPage() {
  const { sessionId = "" } = useParams();
  const session = useKoraSessionExport(sessionId);

  const body = () => {
    if (session.isPending) return <p>Loading the export…</p>;
    if (session.isError) {
      return (
        <p className="text-red-600" role="alert">
          {adminRefusalMessage(
            session.error,
            "Couldn't load the export. Reload to try again.",
          )}
        </p>
      );
    }
    const { reviewerId, endedAt, export: exported } = session.data;
    const parsed = ratingsSchema.safeParse(exported);
    return (
      <>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-zinc-500">Reviewer</dt>
          <dd>{reviewerId}</dd>
          <dt className="text-zinc-500">Ended</dt>
          <dd>{endedAt ? formatKoraDate(endedAt) : "Not yet"}</dd>
        </dl>
        {!exported && <p>No export has been saved yet.</p>}
        {exported && !parsed.success && (
          <p className="text-red-600" role="alert">
            The export has no readable list of ratings. The raw export is below.
          </p>
        )}
        {parsed.success && (
          <table>
            <thead className="text-left text-zinc-500">
              <tr>
                <th className={CELL}>Conversation</th>
                <th className={CELL}>Status</th>
                <th className={CELL}>Kind</th>
              </tr>
            </thead>
            <tbody>
              {parsed.data.ratings.map((rating) => (
                <tr
                  key={rating.conversationId}
                  className="border-t border-zinc-200"
                >
                  <td className={CELL}>{rating.conversationId}</td>
                  <td className={CELL}>{rating.status}</td>
                  <td className={CELL}>{rating.kind ?? "rated"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {exported && (
          <details>
            <summary className="cursor-pointer">Raw export</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-3 text-xs">
              {JSON.stringify(exported, null, 2)}
            </pre>
          </details>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4 p-6 text-sm">
      <title>Kora session export - Admin</title>
      <Link className="underline" to="/kora-participants">
        Back to Kora participants
      </Link>
      <h1 className="text-lg font-semibold">Session export</h1>
      {body()}
    </div>
  );
}
