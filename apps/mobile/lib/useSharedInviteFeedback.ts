import { milliseconds } from "date-fns";
import { useCallback, useRef, useState } from "react";

/** The invite whose link was just shared, for two seconds, so its row can say so. */
export function useSharedInviteFeedback() {
  const [sharedInviteId, setSharedInviteId] = useState<number | null>(null);
  const sharedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShared = useCallback((inviteId: number) => {
    if (sharedTimeoutRef.current) {
      clearTimeout(sharedTimeoutRef.current);
    }
    setSharedInviteId(inviteId);
    sharedTimeoutRef.current = setTimeout(
      () => {
        setSharedInviteId(null);
        sharedTimeoutRef.current = null;
      },
      milliseconds({ seconds: 2 }),
    );
  }, []);

  return { sharedInviteId, handleShared };
}
