import { mountKoraReview } from "@alliance/kora-review";
import { parseKoraTranscript } from "@alliance/kora-review/parse";
import "@alliance/kora-review/style.css";
import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useRandomKoraTranscript } from "../lib/useKoraBatchesAdmin";

const TITLE = <title>Kora transcript preview - Admin</title>;

export default function KoraTranscriptPreviewPage() {
  const { batchId = "" } = useParams();
  const preview = useRandomKoraTranscript(batchId);
  const mountAt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preview.data || !mountAt.current) return;
    const handle = mountKoraReview(mountAt.current, {
      reviewerId: "admin-preview",
      assignment: {
        batchId: `preview-${batchId}`,
        transcripts: [
          {
            transcript: parseKoraTranscript(preview.data.transcript),
            contentHash: preview.data.contentHash,
          },
        ],
      },
      savedExport: null,
      collectProfile: false,
      collectExitSurvey: false,
      save: () => Promise.resolve(),
      onComplete: () => {},
      onSaveStateChange: () => {},
    });
    return () => handle.unmount();
  }, [preview.data, batchId]);

  return (
    <div className="min-h-svh bg-white" data-kora-theme="light">
      {TITLE}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-4 border-b border-zinc-200 bg-yellow-50 px-5 py-3 text-sm">
        <p className="font-medium">
          Preview: this is what reviewers see. Nothing you do here is saved.
        </p>
        <button
          type="button"
          className="underline"
          onClick={() => void preview.refetch()}
          disabled={preview.isFetching}
        >
          Show another transcript
        </button>
        <Link className="underline" to="/kora-participants">
          Back to Kora participants
        </Link>
      </div>
      {preview.isPending && <p className="p-5">Loading a transcript…</p>}
      {preview.isError && (
        <p className="p-5 text-red-600" role="alert">
          {adminRefusalMessage(
            preview.error,
            "Couldn't load a transcript. Reload to try again.",
          )}
        </p>
      )}
      <div ref={mountAt} className="[--kora-top-offset:48px]" />
    </div>
  );
}
