import { mountKoraReview } from "@alliance/kora-review";
import { parseKoraTranscript } from "@alliance/kora-review/parse";
import "@alliance/kora-review/style.css";
import { Eye } from "lucide-react";
import { useEffect, useRef } from "react";
import { useParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useRandomKoraTranscript } from "../../lib/useKoraBatchesAdmin";
import { PlaceId, placeById, tabHref } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { ErrorState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { zIndex } from "../../ui/zIndex";

const ASSIGNMENTS_HREF = tabHref(placeById(PlaceId.KoraParticipants), {
  tab: "assignments",
});

/** Keeps `--kora-top-offset` on the tool at the bar's height, so the tool's own sticky header sits under it. */
function useTopOffset(params: {
  bar: React.RefObject<HTMLElement | null>;
  tool: React.RefObject<HTMLElement | null>;
}) {
  const { bar, tool } = params;
  useEffect(() => {
    const element = bar.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      tool.current?.style.setProperty(
        "--kora-top-offset",
        `${element.offsetHeight}px`,
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [bar, tool]);
}

export default function TranscriptPreviewPage() {
  const { batchId = "" } = useParams();
  const preview = useRandomKoraTranscript(batchId);
  const mountAt = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useTopOffset({ bar: barRef, tool: mountAt });

  useEffect(() => {
    if (!preview.data || !mountAt.current) return;
    const handle = mountKoraReview(mountAt.current, {
      reviewerId: "admin-preview",
      assignment: {
        batchId: `preview-${batchId}`,
        size: 1,
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
      next: () => Promise.resolve(null),
      onComplete: () => {},
      onSaveStateChange: () => {},
    });
    return () => handle.unmount();
  }, [preview.data, batchId]);

  return (
    <div className="min-h-svh bg-surface" data-kora-theme="light">
      <title>Transcript preview - Admin</title>
      <div
        ref={barRef}
        className={cn(
          zIndex.nav,
          "sticky top-0 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-info bg-info-soft px-page py-2.5",
        )}
      >
        <p className="flex min-w-0 flex-1 items-center gap-2 font-medium">
          <Eye aria-hidden="true" className="size-4 shrink-0 text-info" />
          Preview: this is what reviewers see. Nothing you do here is saved.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant={ButtonVariant.Default}
            busy={preview.isFetching}
            onClick={() => void preview.refetch()}
          >
            Show another transcript
          </Button>
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            to={ASSIGNMENTS_HREF}
          >
            Back to assignments
          </Button>
        </div>
      </div>
      {preview.isPending && (
        <p role="status" className="px-page py-section text-fg-muted">
          Loading a transcript…
        </p>
      )}
      {preview.isError && (
        <div className="px-page py-section">
          <ErrorState
            title="Couldn't load a transcript"
            reason={adminRefusalMessage(preview.error, LOAD_FAILED_FALLBACK)}
            onRetry={() => void preview.refetch()}
            retrying={preview.isFetching}
          />
        </div>
      )}
      <div
        ref={mountAt}
        className={cn("isolate", preview.isError && "hidden")}
      />
    </div>
  );
}
