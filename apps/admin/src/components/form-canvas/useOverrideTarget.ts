import { useMemo, useState } from "react";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import {
  userLabel,
  type OverrideTarget,
} from "../display-blocks/perUserContent";
import type { ContentOverride } from "./CanvasElement";

/**
 * The user whose content the selected block shows, for its editors and for
 * the canvas. Selecting anything else returns to the default content.
 */
export function useOverrideTarget(selectionKey: string): {
  target: OverrideTarget;
  override: ContentOverride | null;
} {
  const [held, setHeld] = useState<{ key: string; userId: string } | null>(
    null,
  );
  if (held && held.key !== selectionKey) setHeld(null);
  const userId = held?.key === selectionKey ? held.userId : null;
  const target = useMemo<OverrideTarget>(
    () => ({
      userId,
      select: (next) =>
        setHeld(next === null ? null : { key: selectionKey, userId: next }),
    }),
    [userId, selectionKey],
  );
  const users = useUsersAdmin({ enabled: userId !== null });
  return {
    target,
    override:
      userId === null
        ? null
        : { userId, label: userLabel(users.data ?? [], userId) },
  };
}
