import { milliseconds } from "date-fns";
import { lazy } from "react";

const RELOADED_AT_KEY = "lazy-chunk-reloaded-at";
const RELOAD_WINDOW = milliseconds({ seconds: 10 });

// Stamps and their checks read one clock: timeOrigin drifts from the wall clock.
const now = () => performance.timeOrigin + performance.now();

/** What a lazy component whose chunk didn't load throws. */
export class ChunkLoadError extends Error {
  constructor(cause: unknown) {
    super("This part of the page didn't load. Reload the page to show it.", {
      cause,
    });
  }
}

let reloadHolds = 0;

/**
 * Stops chunks that fail to load from reloading the page until the returned
 * release runs, for an app whose pages keep unsaved work in memory. Their
 * failures reach the error boundary instead.
 */
export function holdChunkReloads(): () => void {
  reloadHolds++;
  return () => {
    reloadHolds--;
  };
}

/**
 * `lazy` that reloads the page when the chunk fails to load, as React Router
 * does for a route module, leaving the Suspense fallback up until the new page
 * arrives. A failure on the page such a reload opened reaches the error
 * boundary instead, however late, so a chunk that never loads can't reload the
 * page forever. So does a reload the visitor cancels.
 */
export const lazyOrReload: typeof lazy = (load) =>
  lazy(() =>
    load().catch((cause: unknown) => {
      const error = new ChunkLoadError(cause);
      const reloadedAt = Number(sessionStorage.getItem(RELOADED_AT_KEY));
      const reloading = () =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(error), RELOAD_WINDOW),
        );
      if (reloadHolds > 0) throw error;
      // Stamped on this page: another chunk already started the reload.
      if (
        reloadedAt >= performance.timeOrigin &&
        now() - reloadedAt < RELOAD_WINDOW
      ) {
        return reloading();
      }
      // Stamped just before this page began loading (the reload opened it), or
      // long ago on this page (the visitor cancelled it).
      if (performance.timeOrigin - reloadedAt < RELOAD_WINDOW) throw error;
      sessionStorage.setItem(RELOADED_AT_KEY, String(now()));
      window.location.reload();
      return reloading();
    }),
  );
