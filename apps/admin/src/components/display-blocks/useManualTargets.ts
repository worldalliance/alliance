import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import { OverrideTargetContext, userLabel } from "./perUserContent";

/** Names a write's target inside a sentence, null being the default content. */
export type TargetLabel = (userId: string | null) => string;

export function useManualTargets(block: DisplayBlock | undefined) {
  const manualUserContent = useMemo(
    () => block?.manualUserContent ?? {},
    [block?.manualUserContent],
  );
  const manualContentKeys = useMemo(
    () => Object.keys(manualUserContent),
    [manualUserContent],
  );
  const manualPerUserEnabled = Boolean(block?.manualPerUser);
  const usersQuery = useUsersAdmin({ enabled: manualPerUserEnabled });
  const manualUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const isLoadingUsers = usersQuery.isLoading;
  const userLoadError = usersQuery.isLoadingError
    ? "Unable to load users"
    : null;
  const refetchUsers = () => void usersQuery.refetch({ cancelRefetch: false });
  const builderTarget = useContext(OverrideTargetContext);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const selectedUserId = builderTarget ? builderTarget.userId : localUserId;
  const selectManualTarget = builderTarget
    ? builderTarget.select
    : setLocalUserId;
  const activeManualUserId = manualPerUserEnabled ? selectedUserId : null;
  const manualTargetList = useMemo(
    () =>
      manualUsers.length > 0
        ? manualUsers.map((candidate) => String(candidate.id))
        : manualContentKeys,
    [manualContentKeys, manualUsers],
  );
  const totalManualTargets = manualTargetList.length;
  const activeManualIndex = useMemo(() => {
    if (!activeManualUserId) return -1;
    return manualTargetList.findIndex((id) => id === activeManualUserId);
  }, [activeManualUserId, manualTargetList]);
  const paginationLabel = useMemo(() => {
    if (totalManualTargets === 0) {
      return "0/0";
    }
    if (!activeManualUserId) {
      return `0/${totalManualTargets}`;
    }
    const displayIndex = activeManualIndex >= 0 ? activeManualIndex + 1 : 1;
    return `${displayIndex}/${totalManualTargets}`;
  }, [activeManualIndex, activeManualUserId, totalManualTargets]);

  const hasContentForActiveUser = Boolean(
    activeManualUserId && manualUserContent[activeManualUserId],
  );
  const activeUser = useMemo(
    () =>
      manualPerUserEnabled && activeManualUserId
        ? manualUsers.find(
            (candidate) => String(candidate.id) === activeManualUserId,
          )
        : undefined,
    [activeManualUserId, manualPerUserEnabled, manualUsers],
  );
  const targetLabel = useCallback<TargetLabel>(
    (userId) =>
      userId ? userLabel(manualUsers, userId) : "the default content",
    [manualUsers],
  );

  // Undo turns per-user content off without going through its toggle.
  useEffect(() => {
    if (!manualPerUserEnabled) selectManualTarget(null);
  }, [manualPerUserEnabled, selectManualTarget]);

  const handleCycleUser = (direction: "prev" | "next") => {
    if (totalManualTargets === 0) return;
    if (!activeManualUserId) {
      selectManualTarget(manualTargetList[0]);
      return;
    }

    const currentIndex = manualTargetList.findIndex(
      (id) => id === activeManualUserId,
    );
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      direction === "next"
        ? (safeIndex + 1) % totalManualTargets
        : (safeIndex - 1 + totalManualTargets) % totalManualTargets;
    selectManualTarget(manualTargetList[nextIndex]);
  };

  return {
    manualUserContent,
    manualContentKeys,
    manualPerUserEnabled,
    manualUsers,
    isLoadingUsers,
    userLoadError,
    refetchUsers,
    selectManualTarget,
    activeManualUserId,
    totalManualTargets,
    paginationLabel,
    hasContentForActiveUser,
    activeUser,
    targetLabel,
    handleCycleUser,
  };
}
