import { mountKoraReview } from "@alliance/kora-review";
import { parseKoraItem } from "@alliance/kora-review/parse";
import "@alliance/kora-review/style.css";
import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useRandomKoraConversation } from "../lib/useKoraBatchesAdmin";

const TITLE = <title>Kora conversation preview - Admin</title>;

export default function KoraConversationPreviewPage() {
  const { batchId = "" } = useParams();
  const preview = useRandomKoraConversation(batchId);
  const mountAt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preview.data || !mountAt.current) return;
    const handle = mountKoraReview(mountAt.current, {
      reviewerId: "admin-preview",
      session: {
        id: `preview-${batchId}`,
        number: 1,
        budgetUnits: 1,
        items: [parseKoraItem(preview.data.item)],
      },
      savedExport: null,
      save: () => Promise.resolve(),
      next: () => Promise.resolve({ done: "budget_spent" }),
      onOptOutRisk: () => {},
      onOpenAccount: () => {},
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
          Show another conversation
        </button>
        <Link className="underline" to="/kora-participants">
          Back to Kora participants
        </Link>
      </div>
      {preview.isPending && <p className="p-5">Loading a conversation…</p>}
      {preview.isError && (
        <p className="p-5 text-red-600" role="alert">
          {adminRefusalMessage(
            preview.error,
            "Couldn't load a conversation. Reload to try again.",
          )}
        </p>
      )}
      <div ref={mountAt} className="[--kora-top-offset:48px]" />
    </div>
  );
}
