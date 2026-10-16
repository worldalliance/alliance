import type { AggregateViewSchema } from "@alliance/common/forms/form-schema";
import {
  homePagePriorityComparator,
  type ActionWithAwayStatus,
} from "@alliance/shared/lib/actionUtils";
import { runAsync } from "@alliance/shared/lib/utils";
import { useEffect, useMemo, useState } from "react";
import {
  buildSidebarProgressBarEntries,
  fetchTaskFormProgressViewsByFormId,
  mapFormViewsToActionIds,
  sidebarProgressActionCandidates,
} from "./fetchTaskFormProgressViews";

export function useSidebarProgressBarEntries(
  actions: ActionWithAwayStatus[] | null,
) {
  const [actionProgressViews, setActionProgressViews] = useState<
    Record<number, AggregateViewSchema[]>
  >({});

  useEffect(() => {
    if (!actions) {
      setActionProgressViews({});
      return;
    }

    const candidates = sidebarProgressActionCandidates(actions);
    if (candidates.length === 0) {
      setActionProgressViews({});
      return;
    }

    let cancelled = false;
    const formIds = candidates.map((c) => c.formId);

    runAsync(async () => {
      const viewsByFormId = await fetchTaskFormProgressViewsByFormId(formIds);
      if (cancelled) {
        return;
      }
      setActionProgressViews(
        mapFormViewsToActionIds(candidates, viewsByFormId),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [actions]);

  return useMemo(() => {
    if (!actions) {
      return [];
    }
    return buildSidebarProgressBarEntries(actions, actionProgressViews).sort(
      (a, b) => homePagePriorityComparator(a.action, b.action),
    );
  }, [actionProgressViews, actions]);
}
