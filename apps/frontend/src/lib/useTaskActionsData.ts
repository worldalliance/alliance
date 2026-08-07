import { ActionDto, actionsDismissAction } from "@alliance/shared/client";
import { useActionsQuery } from "@alliance/shared/lib/actionsListPage";
import {
  ActionWithAwayStatus,
  withOptimisticDismissal,
} from "@alliance/shared/lib/actionUtils";
import { type ParsedGeneralUpdate } from "@alliance/shared/lib/generalUpdates";
import { useUnreadGeneralUpdates } from "@alliance/shared/lib/useGeneralUpdates";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export function useTaskActionsData(options?: {
  refetchInterval?: number | false;
}): {
  actions: ActionWithAwayStatus[] | null;
  generalUpdates: ParsedGeneralUpdate[] | null;
  loading: boolean;
  handleDismissAction: (actionId: number) => Promise<void>;
  handleDismissGeneralUpdate: (generalUpdateId: number) => Promise<void>;
} {
  const queryClient = useQueryClient();
  const {
    data: actionsData,
    isLoading: actionsLoading,
    isError: actionsError,
  } = useActionsQuery({ refetchInterval: options?.refetchInterval });
  const {
    generalUpdates: generalUpdatesData,
    isLoading: generalUpdatesLoading,
    isError: generalUpdatesError,
    dismissGeneralUpdate,
  } = useUnreadGeneralUpdates();

  const loading = actionsLoading || generalUpdatesLoading;

  const actions = useMemo<ActionWithAwayStatus[] | null>(() => {
    if (loading || actionsError) {
      return null;
    }

    return (actionsData ?? []).map((action) => ({
      ...action,
      awayStatus: action.awayStatus ?? "not_away",
    }));
  }, [actionsData, loading, actionsError]);

  const generalUpdates = useMemo<ParsedGeneralUpdate[] | null>(() => {
    if (loading || generalUpdatesError) {
      return null;
    }
    return generalUpdatesData;
  }, [generalUpdatesData, loading, generalUpdatesError]);

  const handleDismissAction = useCallback(
    async (actionId: number) => {
      await actionsDismissAction({
        path: { id: actionId },
      });

      queryClient.setQueryData<ActionDto[] | undefined>(["actions"], (prev) =>
        prev?.map((action) =>
          action.id === actionId ? withOptimisticDismissal(action) : action,
        ),
      );
    },
    [queryClient],
  );

  return {
    actions,
    generalUpdates,
    loading,
    handleDismissAction,
    handleDismissGeneralUpdate: dismissGeneralUpdate,
  };
}
