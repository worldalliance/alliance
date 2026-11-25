import { useState } from "react";
import { useSearchParams } from "react-router";
import ActionOverviewTab from "../../action-dashboard/ActionOverviewTab";
import { useActionReporting } from "../../action-dashboard/useActionReporting";
import type { TaskTabProps } from "../taskTabs";

export function OverviewTab({ task, openTab }: TaskTabProps) {
  const reporting = useActionReporting(task, task.id);
  const [, setSearchParams] = useSearchParams();
  const [incompleteUsersExpanded, setIncompleteUsersExpanded] = useState(false);
  return (
    <ActionOverviewTab
      action={task}
      reporting={reporting}
      onTabChange={(tab) => openTab(tab)}
      setSearchParams={setSearchParams}
      incompleteUsersExpanded={incompleteUsersExpanded}
      setIncompleteUsersExpanded={setIncompleteUsersExpanded}
    />
  );
}
