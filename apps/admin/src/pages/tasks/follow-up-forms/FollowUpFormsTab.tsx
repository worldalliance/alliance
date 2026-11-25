import ActionFollowUpFormsTab from "../../../components/ActionFollowUpFormsTab";
import type { TaskTabProps } from "../taskTabs";

export function FollowUpFormsTab({ task, lookups }: TaskTabProps) {
  return (
    <ActionFollowUpFormsTab
      action={task}
      availableTags={lookups.availableTags}
      tagsLoading={lookups.tagsLoading}
      tagsError={lookups.tagsError}
      availableActions={lookups.allActions}
      actionsLoading={lookups.allActionsLoading}
      actionsError={lookups.allActionsLoadFailed}
      availableUsers={lookups.availableUsers}
      usersLoading={lookups.usersLoading}
      usersError={lookups.usersError}
    />
  );
}
