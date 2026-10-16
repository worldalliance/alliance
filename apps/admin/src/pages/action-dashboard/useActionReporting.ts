import { hasMemberActionStarted } from "@alliance/common/actionEvent";
import {
  actionsGetIncompleteUsersAdmin,
  actionsShareUrlStatsAdmin,
  analyticsGetActionStatsByIdAdmin,
  type FormResponseDto,
  type ProfileDto,
  type ShareUrlStatsDto,
} from "@alliance/shared/client";
import type { ActionStatus } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { skipToken, useQuery } from "@tanstack/react-query";
import type { FormWithSchema } from "../../components/FormResponsesView";
import { formResponsesAdminQuery } from "../../lib/useFormResponsesAdmin";

export type ActionReporting = ReturnType<typeof useActionReporting>;

const LISTS_INCOMPLETE_USERS: Record<ActionStatus, boolean> = {
  draft: false,
  planned: false,
  office_action: true,
  member_action: false,
  resolution: true,
  completed: true,
  failed: true,
  abandoned: true,
};

const NO_SHARE_URL_STATS: ShareUrlStatsDto[] = [];
const NO_RESPONSES: FormResponseDto[] = [];
const NO_USERS: ProfileDto[] = [];

export function useActionReporting(
  action: Pick<
    ParsedActionDto,
    "events" | "optional" | "publicOnly" | "status" | "taskFormId"
  > | null,
  actionId: number | null,
) {
  const loadsShareUrlStats = action?.publicOnly === true;
  const shareUrlStats = useQuery({
    queryKey: queryKeys.actionShareUrlStatsAdmin(actionId),
    queryFn:
      actionId === null || !loadsShareUrlStats
        ? skipToken
        : () =>
            actionsShareUrlStatsAdmin({
              path: { actionId },
              query: { questionId: "field-1765411401186" },
              throwOnError: true,
            }).then((res) => res.data),
  });

  const memberActionStarted =
    action !== null && hasMemberActionStarted(action.events, new Date());
  const actionStats = useQuery({
    queryKey: queryKeys.actionStatsByIdAdmin(actionId),
    queryFn:
      actionId === null || !memberActionStarted
        ? skipToken
        : () =>
            analyticsGetActionStatsByIdAdmin({
              path: { actionId: actionId.toString() },
              throwOnError: true,
            }).then((res) => res.data),
  });

  const taskForm = useTaskForm(action?.taskFormId);
  const formResponses = useQuery(
    formResponsesAdminQuery(
      memberActionStarted ? action?.taskFormId : undefined,
    ),
  );

  const listsIncompleteUsers =
    memberActionStarted &&
    !action.optional &&
    LISTS_INCOMPLETE_USERS[action.status];
  const incompleteUsers = useQuery({
    queryKey: queryKeys.actionIncompleteUsersAdmin(actionId),
    queryFn:
      actionId === null || !listsIncompleteUsers
        ? skipToken
        : () =>
            actionsGetIncompleteUsersAdmin({
              path: { id: actionId },
              throwOnError: true,
            }).then((res) => res.data),
  });

  return {
    shareUrlStats:
      (loadsShareUrlStats && shareUrlStats.data) || NO_SHARE_URL_STATS,
    shareUrlStatsLoading: shareUrlStats.isLoading,
    actionStats: actionStats.data ?? null,
    // Unparsed: the server validates a form's schema before storing it.
    taskForm: (taskForm.data ?? null) as unknown as FormWithSchema | null,
    formResponses: formResponses.data ?? NO_RESPONSES,
    incompleteUsers: (listsIncompleteUsers && incompleteUsers.data) || NO_USERS,
  };
}
