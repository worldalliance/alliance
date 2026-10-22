import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useMemo } from "react";
import { referencedActionFromListItem } from "./referencedAction";

export const useAllActions = () => {
  const list = useActionsAdmin();
  const allActions = useMemo(
    () =>
      (list.data ?? []).map((a) => ({
        ...referencedActionFromListItem(a),
        name: a.name,
        usersCompleted: a.usersCompleted ?? 0,
      })),
    [list.data],
  );

  return {
    allActions,
    allActionsLoading: list.isPending,
    allActionsLoadFailed: list.isError && !list.data,
  };
};
