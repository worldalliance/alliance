import {
  useActionsQuery,
  useDismissActionMutation,
} from "@alliance/shared/lib/actionsListPage";
import { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import { type ParsedGeneralUpdate } from "@alliance/shared/lib/generalUpdates";
import { useUnreadGeneralUpdates } from "@alliance/shared/lib/useGeneralUpdates";
import { useCallback, useMemo } from "react";
import { type LoadFailure } from "../components/LoadFailed";

export function useTaskActionsData(options?: {
  refetchInterval?: number | false;
}): {
  actions: ActionWithAwayStatus[] | null;
  generalUpdates: ParsedGeneralUpdate[] | null;
  generalUpdatesFailure: LoadFailure | null;
  actionsFailure: LoadFailure | null;
  handleDismissAction: (actionId: number) => Promise<void>;
  handleDismissGeneralUpdate: (generalUpdateId: number) => Promise<void>;
} {
  const { mutateAsync: dismissAction } = useDismissActionMutation();
  const actionsQuery = useActionsQuery({
    refetchInterval: options?.refetchInterval,
  });
  const {
    data: actionsData,
    isLoading: actionsLoading,
    isFetching: actionsFetching,
    refetch: refetchActions,
  } = actionsQuery;
  const didActionsFail = failedToLoad(actionsQuery);
  const {
    generalUpdates: generalUpdatesData,
    isLoading: generalUpdatesLoading,
    isFetching: generalUpdatesFetching,
    didFail: didGeneralUpdatesFail,
    refetch: refetchGeneralUpdates,
    dismissGeneralUpdate,
  } = useUnreadGeneralUpdates();

  const loading =
    (actionsLoading && !didActionsFail) ||
    (generalUpdatesLoading && !didGeneralUpdatesFail);

  const actions = useMemo<ActionWithAwayStatus[] | null>(() => {
    if (loading || !actionsData) {
      return null;
    }

    return actionsData.map((action) => ({
      ...action,
      awayStatus: action.awayStatus ?? "not_away",
    }));
  }, [actionsData, loading]);

  const generalUpdates = useMemo<ParsedGeneralUpdate[] | null>(() => {
    if (loading) {
      return null;
    }
    return generalUpdatesData;
  }, [generalUpdatesData, loading]);

  const handleDismissAction = useCallback(
    async (actionId: number) => {
      await dismissAction(actionId);
    },
    [dismissAction],
  );

  return {
    actions,
    generalUpdates,
    generalUpdatesFailure: didGeneralUpdatesFail
      ? {
          onRetry: () => void refetchGeneralUpdates(),
          retrying: generalUpdatesFetching,
        }
      : null,
    actionsFailure: didActionsFail
      ? { onRetry: () => void refetchActions(), retrying: actionsFetching }
      : null,
    handleDismissAction,
    handleDismissGeneralUpdate: dismissGeneralUpdate,
  };
}
