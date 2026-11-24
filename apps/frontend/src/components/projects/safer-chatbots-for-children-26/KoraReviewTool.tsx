import {
  KoraSaveState,
  mountKoraReview,
  type KoraReviewHandle,
  type KoraReviewOptions,
} from "@alliance/kora-review";
import {
  parseKoraCategories,
  parseKoraExport,
  parseKoraTranscript,
} from "@alliance/kora-review/parse";
import "@alliance/kora-review/style.css";
import type { KoraReviewStateDto } from "@alliance/shared/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { REVIEW_COPY } from "./copy";
import "./koraFonts.css";
import { nextKoraTranscript, saveKoraExport } from "./useKoraReview";

export type KoraToolOptions = Omit<
  KoraReviewOptions,
  "onComplete" | "onSaveStateChange"
>;

/** Remounts whenever `options` changes identity, so memoize it. */
export function KoraReviewTool({
  options,
  onComplete,
}: {
  options: KoraToolOptions;
  onComplete: () => void;
}) {
  const mountAt = useRef<HTMLDivElement>(null);
  const handle = useRef<KoraReviewHandle | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const completed = useRef(onComplete);
  completed.current = onComplete;

  useEffect(() => {
    if (!mountAt.current) return;
    const mounted = mountKoraReview(mountAt.current, {
      ...options,
      onComplete: () => completed.current(),
      onSaveStateChange: (saveState) =>
        setSaveFailed(saveState === KoraSaveState.Failed),
    });
    handle.current = mounted;
    return () => {
      handle.current = null;
      void mounted.flush().finally(() => mounted.unmount());
    };
  }, [options]);

  return (
    <>
      {saveFailed && (
        <div
          role="alert"
          className="sticky top-[var(--site-nav-height)] z-30 flex flex-wrap items-center gap-3 bg-red-50 px-5 py-3 text-red-800"
        >
          <p>{REVIEW_COPY.saveFailed}</p>
          <button
            type="button"
            className="min-h-6 underline"
            onClick={() => void handle.current?.flush().catch(() => {})}
          >
            {REVIEW_COPY.retrySave}
          </button>
        </div>
      )}
      <div
        ref={mountAt}
        data-kora-theme="light"
        className="flex flex-1 flex-col *:flex-1 [--site-font-body:'Kora_TT_Neoris','TT_Neoris',system-ui,sans-serif] [--kora-font-family:var(--site-font-body)] [--kora-font-family-display:var(--site-font-body)] [--kora-top-offset:var(--site-nav-height)]"
      />
    </>
  );
}

export function KoraAssignmentReview({
  state,
  onComplete,
}: {
  state: KoraReviewStateDto;
  onComplete: () => void;
}) {
  const assignment = state.assignment;
  const options = useMemo(
    (): KoraToolOptions | null =>
      assignment
        ? {
            reviewerId: state.reviewerId,
            assignment: {
              batchId: assignment.id,
              size: assignment.size,
              transcripts: assignment.transcripts.map((t) => ({
                transcript: parseKoraTranscript(t.transcript),
                contentHash: t.contentHash,
              })),
            },
            savedExport: assignment.savedExport
              ? parseKoraExport(assignment.savedExport)
              : null,
            collectProfile: state.collectProfile,
            collectExitSurvey: !assignment.extra,
            optOutCategories: parseKoraCategories(state.optOutCategories),
            save: (exported) => saveKoraExport(assignment.id, { ...exported }),
            next: () => nextKoraTranscript(assignment.id),
          }
        : null,
    [
      assignment,
      state.reviewerId,
      state.collectProfile,
      state.optOutCategories,
    ],
  );
  return (
    options && <KoraReviewTool options={options} onComplete={onComplete} />
  );
}
