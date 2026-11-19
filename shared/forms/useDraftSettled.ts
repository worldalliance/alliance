import { useEffect, useState } from "react";

/**
 * Whether a form's draft answers are ready to read: the draft stored on this
 * device has been read and, while fetching is on, the fetch has settled
 * (landed or failed) since it turned on. Call it beside the effects that
 * apply the fetched draft: it turns on from an effect too, so in the same
 * render as the restored answers. Once `localDraftRead` is on it must stay
 * on, since only fetching turning off resets the hook.
 */
export function useDraftSettled(params: {
  localDraftRead: boolean;
  fetchEnabled: boolean;
  fetchSettled: boolean;
}): boolean {
  const { localDraftRead, fetchEnabled, fetchSettled } = params;
  // Stays on while a refetch runs, and resets when fetching turns off so that
  // turning it on again waits for the next fetch.
  const [settledSinceEnabled, setSettledSinceEnabled] = useState(false);
  useEffect(() => {
    if (!fetchEnabled) setSettledSinceEnabled(false);
    else if (localDraftRead && fetchSettled) setSettledSinceEnabled(true);
  }, [localDraftRead, fetchEnabled, fetchSettled]);
  return localDraftRead && (!fetchEnabled || settledSinceEnabled);
}
