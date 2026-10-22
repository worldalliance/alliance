import { useEffect, useMemo, useRef, useState } from "react";
import { isLedBy } from "./communityUtils";

export type InvitePlacement =
  | { kind: "community"; id: number }
  | { kind: "assign" }
  | { kind: "new" };

type Community = { id: number; leaders: { id: number }[] };

function firstLedOrNew(leaderCommunities: Community[]): InvitePlacement {
  const led = leaderCommunities[0];
  return led ? { kind: "community", id: led.id } : { kind: "new" };
}

/**
 * Where a new invite places its invitee: a group the user leads until they
 * pick otherwise, falling back when the picked group stops being one they lead.
 */
export function useInvitePlacement<C extends Community>(
  communities: C[],
  userId: number | undefined,
) {
  const [placement, setPlacement] = useState<InvitePlacement>({
    kind: "new",
  });

  const leaderCommunities = useMemo(
    () =>
      userId === undefined
        ? []
        : communities.filter((community) => isLedBy(community, userId)),
    [communities, userId],
  );

  const selectedCommunity =
    placement.kind === "community"
      ? (leaderCommunities.find((community) => community.id === placement.id) ??
        null)
      : null;

  // Runs once so it never clobbers a manual selection on a later refetch.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || communities.length === 0 || userId === undefined) {
      return;
    }
    didInit.current = true;
    setPlacement(firstLedOrNew(leaderCommunities));
  }, [communities.length, leaderCommunities, userId]);

  useEffect(() => {
    if (placement.kind === "community" && !selectedCommunity) {
      setPlacement(firstLedOrNew(leaderCommunities));
    }
  }, [placement.kind, selectedCommunity, leaderCommunities]);

  return { placement, setPlacement, leaderCommunities, selectedCommunity };
}
