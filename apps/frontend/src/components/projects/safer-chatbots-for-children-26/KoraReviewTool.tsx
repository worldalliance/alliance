import {
  KoraSaveState,
  mountKoraReview,
  type KoraReviewHandle,
  type KoraReviewOptions,
} from "@alliance/kora-review";
import "@alliance/kora-review/style.css";
import { useEffect, useRef, useState } from "react";
import { NAV_HEIGHT } from "../../../site/Navbar";
import { REVIEW_COPY } from "./copy";

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
          className="sticky z-30 flex flex-wrap items-center gap-3 bg-red-50 px-5 py-3 text-red-800"
          style={{ top: NAV_HEIGHT }}
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
        className="[--kora-font-family:var(--site-font-body)] [--kora-font-family-display:var(--site-font-body)] [--kora-top-offset:var(--site-nav-height)]"
      />
    </>
  );
}
