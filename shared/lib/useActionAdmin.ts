import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  ActionDto,
  actionsArchiveAdmin,
  actionsCreateAdmin,
  actionsCreateFollowUpFormAdmin,
  actionsDeleteFollowUpFormAdmin,
  actionsFindOneAdmin,
  actionsRemoveAdmin,
  actionsUnarchiveAdmin,
  actionsUpdateAdmin,
  actionsUpdateFollowUpFormAdmin,
  CreateActionDto,
  CreateFollowUpFormDto,
  UpdateActionDto,
  UpdateFollowUpFormDto,
} from "../client";
import { parseActionDto } from "../parsed-dtos";
import { queryKeys } from "./queryKeys";
import { useInvalidateFormsIndex } from "./useFormsAdmin";

/**
 * The admin action-detail query. Fetches the action and validates its
 * jsonb-backed cohortExpression at the boundary, so consumers get a
 * ParsedActionDto plus the (degraded, non-throwing) parse error — see
 * `../parsed-dtos`.
 *
 * A `null` actionId yields a skipToken query that never fetches.
 */
export function actionAdminQuery(actionId: number | null) {
  return queryOptions({
    queryKey: queryKeys.actionAdmin(actionId),
    queryFn:
      actionId === null
        ? skipToken
        : () =>
            actionsFindOneAdmin({
              path: { id: actionId },
              throwOnError: true,
            }).then((res) => parseActionDto(res.data)),
  });
}

function withAdded(ids: ReadonlySet<number>, id: number): ReadonlySet<number> {
  return new Set(ids).add(id);
}

function withRemoved(
  ids: ReadonlySet<number>,
  id: number,
): ReadonlySet<number> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

/**
 * Single source of truth for one admin action — wraps `actionsFindOneAdmin`
 * and the action/follow-up-form mutation endpoints in react-query, sharing
 * one cache key per action that the mutations invalidate on success.
 *
 * Pass `actionId: null` to skip fetching (e.g. the create-new page, or a
 * conditional consumer); mutations that need an id throw if used then.
 * `enabled: false` keeps the mutations but never fetches — for components
 * that receive the action via props and only mutate.
 *
 * Mutations are exposed as plain async functions plus the pending facts
 * consumers need (`isSaving`, `deletingFollowUpFormIds`, …), not as raw
 * `useMutation` results — callers attach `onError` per call site.
 */
export function useActionAdmin(
  actionId: number | null,
  params?: { enabled?: boolean },
) {
  const { enabled = true } = params ?? {};
  const queryClient = useQueryClient();
  const invalidateFormsIndex = useInvalidateFormsIndex();

  const query = useQuery({
    ...actionAdminQuery(actionId),
    enabled,
  });
  const action = query.data?.action ?? null;
  const cohortExpressionError = query.data?.cohortExpressionError ?? null;

  const requireActionId = () => {
    if (actionId === null) {
      throw new Error("This mutation requires an actionId");
    }
    return actionId;
  };

  const invalidate = () =>
    actionId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: queryKeys.actionAdmin(actionId),
        });

  // For mutations that change fields the all-actions list shows (name,
  // archived, existence); marks it stale so list screens refetch on return.
  // The forms index carries the same facts as usedInAction, so it goes stale
  // on exactly these mutations too.
  const invalidateList = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionsAllAdmin(),
      }),
      invalidateFormsIndex(),
    ]);

  const invalidateActionAndList = () =>
    Promise.all([invalidate(), invalidateList()]);

  /**
   * For child flows that hand back a raw ActionDto: validate the
   * cohortExpression at the boundary and write the result into the query
   * cache, so `action` is always parsed.
   */
  const setActionFromDto = useCallback(
    (dto: ActionDto) => {
      queryClient.setQueryData(
        queryKeys.actionAdmin(dto.id),
        parseActionDto(dto),
      );
    },
    [queryClient],
  );

  const createActionMutation = useMutation({
    // No per-action invalidation: the new action has its own (not-yet-fetched)
    // key and callers navigate to it.
    mutationFn: (body: CreateActionDto) =>
      actionsCreateAdmin({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: invalidateList,
  });

  const updateActionMutation = useMutation({
    mutationFn: (body: UpdateActionDto) =>
      actionsUpdateAdmin({
        path: { id: requireActionId() },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidateActionAndList,
  });

  const removeActionMutation = useMutation({
    // No per-action invalidation: refetching a deleted action would just 404;
    // callers navigate away.
    mutationFn: () =>
      actionsRemoveAdmin({
        path: { id: requireActionId() },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidateList,
  });

  const archiveActionMutation = useMutation({
    mutationFn: () =>
      actionsArchiveAdmin({
        path: { id: requireActionId() },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidateActionAndList,
  });

  const unarchiveActionMutation = useMutation({
    mutationFn: () =>
      actionsUnarchiveAdmin({
        path: { id: requireActionId() },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidateActionAndList,
  });

  const createFollowUpFormMutation = useMutation({
    mutationFn: (body: CreateFollowUpFormDto) =>
      actionsCreateFollowUpFormAdmin({
        path: { id: requireActionId() },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidate,
  });

  // A single useMutation only exposes the latest call's `variables`, but
  // saves/deletes of *different* follow-up forms can be in flight at once —
  // track the pending ids explicitly.
  const [savingFollowUpFormIds, setSavingFollowUpFormIds] = useState<
    ReadonlySet<number>
  >(new Set());
  const [deletingFollowUpFormIds, setDeletingFollowUpFormIds] = useState<
    ReadonlySet<number>
  >(new Set());

  const updateFollowUpFormMutation = useMutation({
    mutationFn: ({
      followUpFormId,
      body,
    }: {
      followUpFormId: number;
      body: UpdateFollowUpFormDto;
    }) =>
      actionsUpdateFollowUpFormAdmin({
        path: { followUpFormId },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onMutate: ({ followUpFormId }) => {
      setSavingFollowUpFormIds((ids) => withAdded(ids, followUpFormId));
    },
    onSettled: (_result, _error, { followUpFormId }) => {
      setSavingFollowUpFormIds((ids) => withRemoved(ids, followUpFormId));
    },
    onSuccess: invalidate,
  });

  const deleteFollowUpFormMutation = useMutation({
    mutationFn: (followUpFormId: number) =>
      actionsDeleteFollowUpFormAdmin({
        path: { followUpFormId },
        throwOnError: true,
      }).then((r) => r.data),
    onMutate: (followUpFormId) => {
      setDeletingFollowUpFormIds((ids) => withAdded(ids, followUpFormId));
    },
    onSettled: (_result, _error, followUpFormId) => {
      setDeletingFollowUpFormIds((ids) => withRemoved(ids, followUpFormId));
    },
    onSuccess: invalidate,
  });

  return {
    action,
    cohortExpressionError,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    setActionFromDto,
    createAction: createActionMutation.mutateAsync,
    isCreating: createActionMutation.isPending,
    updateAction: updateActionMutation.mutateAsync,
    isUpdating: updateActionMutation.isPending,
    removeAction: removeActionMutation.mutateAsync,
    isRemoving: removeActionMutation.isPending,
    archiveAction: archiveActionMutation.mutateAsync,
    unarchiveAction: unarchiveActionMutation.mutateAsync,
    createFollowUpForm: createFollowUpFormMutation.mutateAsync,
    isCreatingFollowUpForm: createFollowUpFormMutation.isPending,
    updateFollowUpForm: updateFollowUpFormMutation.mutateAsync,
    savingFollowUpFormIds,
    deleteFollowUpForm: deleteFollowUpFormMutation.mutateAsync,
    deletingFollowUpFormIds,
  };
}
