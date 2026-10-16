import {
  actionsSetPriorityAdmin,
  type SetPriorityDto,
} from "@alliance/shared/client";
import { useInvalidateActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useMutation } from "@tanstack/react-query";
import { useInvalidateGeneralUpdatesAdmin } from "./useGeneralUpdatesAdmin";

/** `onSuccess` runs before the lists this invalidates start reloading, so a
 * time it takes precedes their next `dataUpdatedAt`. */
export function useSetPrioritiesAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const invalidateActions = useInvalidateActionsAdmin();
  const invalidateGeneralUpdates = useInvalidateGeneralUpdatesAdmin();
  return useMutation({
    mutationFn: (body: SetPriorityDto) =>
      actionsSetPriorityAdmin({ body, throwOnError: true }),
    onSuccess: () => {
      onSuccess();
      void invalidateActions();
      void invalidateGeneralUpdates();
    },
    onError,
  });
}
