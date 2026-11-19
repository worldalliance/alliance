import type { UnrenderableSubject } from "@alliance/shared/forms/unrenderable";
import { UPDATE_RECHECK_INTERVAL_MS } from "../lib/updateRechecks";
import { UpdateSearchOutcome } from "../lib/updateSearch";
import { RESTART_FAILED_MESSAGE } from "./updateCopy";

export enum RecoveryAction {
  Restart = "restart",
  OpenStore = "openStore",
  Retry = "retry",
}

export type RecoveryView = {
  message: string;
  action: RecoveryAction | null;
};

/** What the notice says and offers, given where the search for a newer version got to. */
export function updateRecoveryView(params: {
  subject: UnrenderableSubject;
  /** An update is downloaded and waiting for a restart. */
  ready: boolean;
  restartFailed: boolean;
  outcome: UpdateSearchOutcome | null;
  store: { name: string } | null;
}): RecoveryView {
  const { subject, ready, restartFailed, outcome, store } = params;
  if (ready || outcome === UpdateSearchOutcome.Downloaded) {
    return {
      message: restartFailed
        ? RESTART_FAILED_MESSAGE
        : "Restart Alliance to finish updating.",
      action: RecoveryAction.Restart,
    };
  }
  const notOutYet: RecoveryView = {
    message: `The version of Alliance this ${subject} needs isn’t out yet. Please try again later.`,
    action: null,
  };
  if (outcome === null) {
    return { message: "Getting the latest version…", action: null };
  }
  switch (outcome) {
    case UpdateSearchOutcome.None:
      return notOutYet;
    case UpdateSearchOutcome.InStore:
      return store === null
        ? notOutYet
        : {
            message: `Get it from the ${store.name}.`,
            action: RecoveryAction.OpenStore,
          };
    case UpdateSearchOutcome.Failed:
      return {
        message:
          "Couldn’t check for an update. Check your connection and try again.",
        action: RecoveryAction.Retry,
      };
    default:
      throw new Error(`unknown outcome: ${outcome satisfies never}`);
  }
}

const RECHECKS_FOR: Record<RecoveryAction, boolean> = {
  [RecoveryAction.Restart]: false,
  [RecoveryAction.OpenStore]: false,
  [RecoveryAction.Retry]: true,
};

/**
 * Whether the notice searches again by itself: while its screen is in view,
 * once a search has said the version isn't out yet or failed. A Stack keeps a
 * covered screen mounted, so its notice would otherwise keep polling.
 */
export function rechecksForUpdate(params: {
  outcome: UpdateSearchOutcome | null;
  view: RecoveryView;
  focused: boolean;
}): boolean {
  const { outcome, view, focused } = params;
  if (!focused || outcome === null) return false;
  return view.action === null || RECHECKS_FOR[view.action];
}

/** A recheck that fails keeps what the last search found, so a dropped connection doesn't turn "isn't out yet" into an error. */
export function afterRecheck(params: {
  previous: UpdateSearchOutcome;
  found: UpdateSearchOutcome;
}): UpdateSearchOutcome {
  return params.found === UpdateSearchOutcome.Failed
    ? params.previous
    : params.found;
}

/**
 * Starts a notice's first search, recording when it ends in `searchedAt` so
 * rechecks starting then don't repeat it. Applies what it finds until the
 * returned function runs.
 */
export function startNoticeSearch(params: {
  search: () => Promise<UpdateSearchOutcome>;
  setOutcome: (found: UpdateSearchOutcome) => void;
  searchedAt: { current: number };
}): () => void {
  let current = true;
  void params.search().then((found) => {
    params.searchedAt.current = Date.now();
    if (current) params.setOutcome(found);
  });
  return () => {
    current = false;
  };
}

/**
 * Searches again on each recheck, and at once when a full interval has passed
 * since `searchedAt`, so a notice coming back into view doesn't wait another.
 * Applies what it finds, recording the time in `searchedAt`, until the
 * returned function runs; a search still under way then is dropped, so it
 * can't overwrite what a newer search found.
 */
export function startNoticeRechecks(params: {
  onRecheck: (listener: () => void) => () => void;
  search: () => Promise<UpdateSearchOutcome>;
  setOutcome: (
    next: (previous: UpdateSearchOutcome | null) => UpdateSearchOutcome,
  ) => void;
  searchedAt: { current: number };
}): () => void {
  let current = true;
  const recheck = () => {
    void params.search().then((found) => {
      if (!current) return;
      params.searchedAt.current = Date.now();
      // "Try again" clears the outcome while its own search runs.
      params.setOutcome((previous) =>
        previous === null ? found : afterRecheck({ previous, found }),
      );
    });
  };
  const stop = params.onRecheck(recheck);
  if (Date.now() - params.searchedAt.current >= UPDATE_RECHECK_INTERVAL_MS) {
    recheck();
  }
  return () => {
    current = false;
    stop();
  };
}
