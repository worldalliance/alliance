import {
  actionUpdatesCreateUpdateAdmin,
  actionUpdatesDeleteUpdateAdmin,
  actionUpdatesFindOneUpdateAdmin,
  actionUpdatesNotifyUpdateAdmin,
  actionUpdatesPublishUpdateNowAdmin,
  actionUpdatesUnpublishUpdateAdmin,
  actionUpdatesUpdateUpdateAdmin,
  type ActionUpdateDto,
  type AdminActionUpdateDto,
  type CreateActionUpdateDto,
  type UpdateActionUpdateDto,
} from "@alliance/shared/client";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useCallback } from "react";
import {
  useDisplayOnlySchemaSave,
  type DisplayOnlySchemaSaveBody,
} from "./useDisplayOnlySchemaSave";
import { useStoreQueryData } from "./usePatchQueryData";

export const HELD_POLL_MS = milliseconds({ seconds: 15 });

/** One admin action update and its writes. A `null` id fetches nothing, for
 * the updates tab, which only creates and deletes; the other writes throw
 * then. Every write refreshes the action, whose `updates` the tab lists. */
export function useActionUpdateAdmin(id: number | null) {
  const queryClient = useQueryClient();
  const storeQueryData = useStoreQueryData();

  const query = useQuery({
    queryKey: queryKeys.actionUpdateAdmin(id),
    queryFn:
      id === null
        ? skipToken
        : () =>
            actionUpdatesFindOneUpdateAdmin({
              path: { id },
              throwOnError: true,
            }).then((r) => r.data),
    // The server retries a held update each minute, so its banner follows
    // those retries instead of showing the reason from before a fix.
    refetchInterval: ({ state }) =>
      state.data?.notificationHeldReason ? HELD_POLL_MS : false,
  });

  const invalidateAction = useCallback(
    (actionId: number) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionAdmin(actionId),
      }),
    [queryClient],
  );

  const store = useCallback(
    async (saved: AdminActionUpdateDto) => {
      await storeQueryData(queryKeys.actionUpdateAdmin(saved.id), saved);
      await invalidateAction(saved.actionId);
    },
    [storeQueryData, invalidateAction],
  );

  const requireId = useCallback(() => {
    if (id === null) throw new Error("No action update to change");
    return id;
  }, [id]);

  const create = useMutation({
    mutationFn: (params: { actionId: number; body: CreateActionUpdateDto }) =>
      actionUpdatesCreateUpdateAdmin({
        path: { id: params.actionId },
        body: params.body,
        throwOnError: true,
      }).then((r) => r.data),
    // The editor loads the update itself, so the tab opens it without
    // waiting on the action reload.
    onSuccess: (saved) => void invalidateAction(saved.actionId),
  });

  const update = useMutation({
    mutationFn: (body: UpdateActionUpdateDto) =>
      actionUpdatesUpdateUpdateAdmin({
        path: { id: requireId() },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: store,
  });

  const notify = useMutation({
    mutationFn: () =>
      actionUpdatesNotifyUpdateAdmin({
        path: { id: requireId() },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: store,
  });

  const publishNow = useMutation({
    mutationFn: () =>
      actionUpdatesPublishUpdateNowAdmin({
        path: { id: requireId() },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: store,
  });

  const unpublish = useMutation({
    mutationFn: () =>
      actionUpdatesUnpublishUpdateAdmin({
        path: { id: requireId() },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: store,
  });

  const remove = useMutation({
    mutationFn: (target: Pick<ActionUpdateDto, "id" | "actionId">) =>
      actionUpdatesDeleteUpdateAdmin({
        path: { id: target.id },
        throwOnError: true,
      }).then(() => undefined, rethrowUnlessNotFound),
    onSuccess: async (_, target) => {
      queryClient.removeQueries({
        queryKey: queryKeys.actionUpdateAdmin(target.id),
      });
      await invalidateAction(target.actionId);
    },
  });

  const saveSchema = useDisplayOnlySchemaSave({
    ownerLabel: "Updates",
    save: useCallback(
      (body: DisplayOnlySchemaSaveBody) =>
        actionUpdatesUpdateUpdateAdmin({ path: { id: requireId() }, body }),
      [requireId],
    ),
    refetch: useCallback(
      () => actionUpdatesFindOneUpdateAdmin({ path: { id: requireId() } }),
      [requireId],
    ),
    onSaved: useCallback(
      (saved: AdminActionUpdateDto) => void store(saved),
      [store],
    ),
  });

  return {
    query,
    create,
    update,
    notify,
    publishNow,
    unpublish,
    remove,
    saveSchema,
  };
}
