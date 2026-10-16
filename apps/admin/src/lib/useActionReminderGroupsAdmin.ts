import {
  type ActionEventNotifDto,
  actionRemindersCreateReminderGroupAdmin,
  actionRemindersDeleteReminderGroupAdmin,
  actionRemindersPlansForGroupAdmin,
  actionRemindersReminderGroupsForEventAdmin,
  actionRemindersSentNotifsForGroupAdmin,
  actionRemindersUpdateReminderGroupAdmin,
  type CreateReminderGroupDto,
  type PreviewNotificationPlanDto,
  type ReminderGroupDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  skipToken,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { usePatchQueryData } from "./usePatchQueryData";

type ReminderGroupDetails = {
  groupId: number;
  plans: PreviewNotificationPlanDto[];
  sent: ActionEventNotifDto[];
};

const reminderGroupsQuery = (eventId: number | null) =>
  queryOptions({
    queryKey: queryKeys.actionReminderGroupsAdmin(eventId),
    queryFn:
      eventId === null
        ? skipToken
        : () =>
            actionRemindersReminderGroupsForEventAdmin({
              path: { id: eventId },
              throwOnError: true,
            }).then((res) => res.data),
  });

const reminderGroupDetailsQuery = (groupId: number) =>
  queryOptions({
    queryKey: queryKeys.actionReminderGroupDetailsAdmin(groupId),
    queryFn: async (): Promise<ReminderGroupDetails> => {
      const [plans, sent] = await Promise.all([
        actionRemindersPlansForGroupAdmin({
          path: { groupId },
          throwOnError: true,
        }),
        actionRemindersSentNotifsForGroupAdmin({
          path: { groupId },
          throwOnError: true,
        }),
      ]);
      return { groupId, plans: plans.data, sent: sent.data };
    },
    refetchOnWindowFocus: false,
  });

const combineDetails = (results: UseQueryResult<ReminderGroupDetails>[]) => ({
  detailsByGroup: new Map(
    results.flatMap((result) =>
      result.data ? [[result.data.groupId, result.data] as const] : [],
    ),
  ),
  detailsLoadFailed: results.some((result) => result.isError),
});

export function useActionReminderGroupsAdmin(eventId: number | null) {
  const queryClient = useQueryClient();
  const groupsQuery = useMemo(() => reminderGroupsQuery(eventId), [eventId]);
  const { data: groups, isError: groupsLoadFailed } = useQuery(groupsQuery);
  const patchGroups = usePatchQueryData(groupsQuery.queryKey);

  const { detailsByGroup, detailsLoadFailed } = useQueries({
    queries: (groups ?? []).map((group) => reminderGroupDetailsQuery(group.id)),
    combine: combineDetails,
  });

  // Plans are slow to compute, so a write waits only for the lists to reload.
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.actionReminderGroupDetailsAdminAll(),
    });
    return queryClient.invalidateQueries({
      queryKey: queryKeys.actionReminderGroupsAdminEvents(),
    });
  };

  const create = useMutation({
    mutationFn: async (params: {
      eventId: number;
      bodies: CreateReminderGroupDto[];
    }) => {
      const created: ReminderGroupDto[] = [];
      for (const body of params.bodies) {
        const res = await actionRemindersCreateReminderGroupAdmin({
          path: { eventId: params.eventId },
          body,
          throwOnError: true,
        });
        created.push(res.data);
      }
      return created;
    },
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: (params: { groupId: number; body: CreateReminderGroupDto }) =>
      actionRemindersUpdateReminderGroupAdmin({
        path: { groupId: params.groupId },
        body: params.body,
        throwOnError: true,
      }).then((res) => res.data),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (groupId: number) =>
      actionRemindersDeleteReminderGroupAdmin({
        path: { groupId },
        throwOnError: true,
      }),
    // A deleted group's plans fail to load, so it leaves the list, and its
    // details the cache, before the refetch could request them.
    onSuccess: async (_, groupId) => {
      await patchGroups((prev) => prev.filter((group) => group.id !== groupId));
      queryClient.removeQueries({
        queryKey: queryKeys.actionReminderGroupDetailsAdmin(groupId),
      });
    },
    onSettled: invalidate,
  });

  return {
    groups,
    groupsLoadFailed,
    detailsByGroup,
    detailsLoadFailed,
    create,
    update,
    remove,
  };
}
