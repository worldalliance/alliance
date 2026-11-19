import type { UnrenderableSubject } from "@alliance/shared/forms/unrenderable";
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
