import type { ReferencedAction } from "@alliance/common/cohort-expression";
import { actionsFindAllWithDraftsAdmin } from "@alliance/shared/client";
import { useEffect, useState } from "react";
import { referencedActionFromListItem } from "./referencedAction";

export const useAllActions = () => {
  const [allActions, setAllActions] = useState<
    (ReferencedAction & { name: string; usersCompleted: number })[]
  >([]);
  const [allActionsLoading, setAllActionsLoading] = useState(true);
  const [allActionsLoadFailed, setAllActionsLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAllActions = async () => {
      try {
        const response = await actionsFindAllWithDraftsAdmin();
        if (cancelled) return;
        if (!response.data) {
          setAllActionsLoadFailed(true);
        } else {
          setAllActions(
            response.data.map((a) => ({
              ...referencedActionFromListItem(a),
              name: a.name,
              usersCompleted: a.usersCompleted ?? 0,
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load actions for populate:", err);
        if (!cancelled) setAllActionsLoadFailed(true);
      } finally {
        if (!cancelled) {
          setAllActionsLoading(false);
        }
      }
    };

    loadAllActions();

    return () => {
      cancelled = true;
    };
  }, []);

  return { allActions, allActionsLoading, allActionsLoadFailed };
};
