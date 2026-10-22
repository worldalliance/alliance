import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import { useEffect, useRef } from "react";
import { useUpdateProfileMutation } from "./user";

/**
 * Delete this once the accounts that predate signup capture have a zone.
 *
 * Pass `enabled: false` where the session is not the member's own. An admin
 * impersonating a member posts as that member, so the member would end up with
 * the admin's zone.
 *
 * A `detect` that names no valid zone writes nothing, so a later session
 * retries.
 */
export function useBackfillTimeZone(
  user: { id: number; timeZone: string | null } | undefined,
  options: { detect: () => string | undefined; enabled?: boolean },
): void {
  const { detect, enabled = true } = options;
  const { mutate } = useUpdateProfileMutation(user?.id);
  const attemptedForUserId = useRef<number | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !user ||
      user.timeZone ||
      attemptedForUserId.current === user.id
    ) {
      return;
    }
    attemptedForUserId.current = user.id;
    const detected = detect();
    if (!isTimeZoneIdentifier(detected)) return;
    mutate(
      { timeZone: detected },
      {
        onError: (error) =>
          console.error("failed to backfill the member's time zone", error),
      },
    );
  }, [detect, enabled, user, mutate]);
}
