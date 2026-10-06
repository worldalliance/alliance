import { R } from "@alliance/common/result";
import {
  actionsFindOneUpdateAdmin,
  type AdminActionUpdateDto,
} from "@alliance/shared/client";
import { milliseconds } from "date-fns";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";

export const HELD_POLL_MS = milliseconds({ seconds: 15 });

/**
 * The server retries a held update each minute, so its banner follows those
 * retries instead of showing the reason from before a fix until a reload.
 */
export function useRefreshWhileHeld(
  update: AdminActionUpdateDto | null,
  setUpdate: Dispatch<SetStateAction<AdminActionUpdateDto | null>>,
) {
  const latest = useRef(update);
  useEffect(() => {
    latest.current = update;
  }, [update]);

  const heldId = update?.notificationHeldReason ? update.id : null;
  useEffect(() => {
    if (heldId === null) return;
    let cancelled = false;
    const poll = setInterval(async () => {
      const before = latest.current;
      const fetched = await R.fromPromise(
        actionsFindOneUpdateAdmin({ path: { id: heldId }, throwOnError: true }),
        (thrown) => thrown,
      );
      if (!fetched.ok) {
        console.error(fetched.error);
        return;
      }
      if (cancelled) return;
      // A save that landed while this poll was in flight is newer than it.
      // Comparing in the updater sees a save React hasn't rendered yet.
      setUpdate((current) =>
        current === before ? fetched.value.data : current,
      );
    }, HELD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [heldId, setUpdate]);
}
