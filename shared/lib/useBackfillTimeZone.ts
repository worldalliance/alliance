import { useEffect, useRef } from "react";
import { deviceTimeZone } from "./timeZone";
import { useUpdateProfileMutation } from "./user";

/**
 * Delete this once the accounts that predate signup capture have a zone.
 *
 * Pass `enabled: false` where the session is not the member's own. An admin
 * impersonating a member posts as that member, so the member would end up with
 * the admin's zone.
 */
export function useBackfillTimeZone(
  user: { id: number; timeZone?: string } | undefined,
  options?: { enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;
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
    mutate(
      { timeZone: deviceTimeZone() },
      {
        onError: (error) =>
          console.error("failed to backfill the member's time zone", error),
      },
    );
  }, [enabled, user, mutate]);
}
