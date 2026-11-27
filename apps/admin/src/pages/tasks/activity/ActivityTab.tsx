import type { TaskTabProps } from "../taskTabs";
import { ActionHistory } from "./ActionHistory";
import { CohortDecisions } from "./CohortDecisions";
import { historyRows, noDecisionsReason } from "./activityRules";

/** History first: the decisions table can run to every assigned member. */
export function ActivityTab({ task, openTab }: TaskTabProps) {
  const now = new Date();
  return (
    <>
      <ActionHistory
        rows={historyRows({ events: task.events, updates: task.updates, now })}
        openTab={openTab}
      />
      <CohortDecisions
        actionId={task.id}
        emptyReason={noDecisionsReason(task, now)}
      />
    </>
  );
}
