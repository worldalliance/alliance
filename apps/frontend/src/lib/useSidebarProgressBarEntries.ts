import {
  homePagePriorityComparator,
  type ActionWithAwayStatus,
} from "@alliance/shared/lib/actionUtils";
import { useTaskFormsAggregateViews } from "@alliance/shared/lib/useTaskFormAggregateViews";
import { useMemo } from "react";
import {
  buildSidebarProgressBarEntries,
  sidebarProgressFormIds,
} from "./sidebarProgressBarEntries";

export function useSidebarProgressBarEntries(
  actions: ActionWithAwayStatus[] | null,
) {
  const formIds = useMemo(
    () => sidebarProgressFormIds(actions ?? []),
    [actions],
  );
  const viewsByFormId = useTaskFormsAggregateViews(formIds);

  return useMemo(() => {
    if (!actions) {
      return [];
    }
    return buildSidebarProgressBarEntries(actions, viewsByFormId).sort((a, b) =>
      homePagePriorityComparator(a.action, b.action),
    );
  }, [viewsByFormId, actions]);
}
