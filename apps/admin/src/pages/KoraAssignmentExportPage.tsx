import { Link, useParams } from "react-router";
import { z } from "zod";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { formatKoraDate } from "../lib/koraParticipants";
import { useKoraAssignmentExport } from "../lib/useKoraBatchesAdmin";

const CELL = "px-3 py-2 align-top";

const resultsSchema = z.object({
  results: z.array(
    z.looseObject({
      transcriptId: z.string(),
      status: z.string(),
      optedOut: z.boolean().optional(),
    }),
  ),
});

export default function KoraAssignmentExportPage() {
  const { assignmentId = "" } = useParams();
  const assignment = useKoraAssignmentExport(assignmentId);

  const body = () => {
    if (assignment.isPending) return <p>Loading the export…</p>;
    if (assignment.isError) {
      return (
        <p className="text-red-600" role="alert">
          {adminRefusalMessage(
            assignment.error,
            "Couldn't load the export. Reload to try again.",
          )}
        </p>
      );
    }
    const { reviewerId, completedAt, export: exported } = assignment.data;
    const parsed = resultsSchema.safeParse(exported);
    return (
      <>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-zinc-500">Reviewer</dt>
          <dd>{reviewerId}</dd>
          <dt className="text-zinc-500">Completed</dt>
          <dd>{completedAt ? formatKoraDate(completedAt) : "Not yet"}</dd>
        </dl>
        {!exported && <p>No export has been saved yet.</p>}
        {exported && !parsed.success && (
          <p className="text-red-600" role="alert">
            The export has no readable list of results. The raw export is below.
          </p>
        )}
        {parsed.success && (
          <table>
            <thead className="text-left text-zinc-500">
              <tr>
                <th className={CELL}>Transcript</th>
                <th className={CELL}>Status</th>
                <th className={CELL}>Opted out</th>
              </tr>
            </thead>
            <tbody>
              {parsed.data.results.map((r) => (
                <tr key={r.transcriptId} className="border-t border-zinc-200">
                  <td className={CELL}>{r.transcriptId}</td>
                  <td className={CELL}>{r.status}</td>
                  <td className={CELL}>{r.optedOut ? "Yes" : "No"}</td>
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
      <title>Kora assignment export - Admin</title>
      <Link className="underline" to="/kora-participants">
        Back to Kora participants
      </Link>
      <h1 className="text-lg font-semibold">Assignment export</h1>
      {body()}
    </div>
  );
}
