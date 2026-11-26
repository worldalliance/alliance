import { useRef } from "react";
import ActionCompletionCurveChart from "../../../components/ActionCompletionCurveChart";
import { FailedLoadsBanner } from "../../../components/FailedLoadsBanner";
import { useActionReporting } from "../../action-dashboard/useActionReporting";
import type { TaskTabProps } from "../taskTabs";
import { IncompleteMembersPanel } from "./IncompleteMembersPanel";
import { InviteStatsPanel } from "./InviteStatsPanel";
import { ReportStage, reportStage } from "./overviewRules";
import { ResponseStatistics } from "./ResponseStatistics";
import { TaskEventsPanel } from "./TaskEventsPanel";
import { TaskProgressPanel } from "./TaskProgressPanel";
import { TaskProjectPanel } from "./TaskProjectPanel";

/**
 * How the task is going. Which reports show is decided from the task alone,
 * except the members who failed to complete, hidden once that list loads empty.
 */
export function OverviewTab({ task, openTab, setError }: TaskTabProps) {
  const now = new Date();
  const phaseRef = useRef<HTMLButtonElement>(null);
  const eventsRef = useRef<HTMLOListElement>(null);
  const reporting = useActionReporting(task, task.id);
  const started = reportStage(task, now) === ReportStage.Started;
  return (
    <>
      <FailedLoadsBanner
        failed={reporting.failedLoads}
        consequence="The reports below are incomplete."
      />
      <TaskProgressPanel
        task={task}
        reporting={reporting}
        openTab={openTab}
        now={now}
        phaseRef={phaseRef}
      />
      {reporting.listsIncompleteUsers &&
        (reporting.incompleteUsersLoading ||
          reporting.incompleteUsersFailed ||
          reporting.incompleteUsers.length > 0) && (
          <IncompleteMembersPanel
            users={reporting.incompleteUsers}
            loading={reporting.incompleteUsersLoading}
            failed={reporting.incompleteUsersFailed}
          />
        )}
      {started && !task.publicOnly && !task.optional && (
        <ActionCompletionCurveChart
          title="Completion over time"
          actionId={task.id}
          showSelector={false}
        />
      )}
      {started && task.taskFormId !== null && (
        <ResponseStatistics reporting={reporting} openTab={openTab} />
      )}
      {task.publicOnly && (
        <InviteStatsPanel
          stats={reporting.shareUrlStats}
          loading={reporting.shareUrlStatsLoading}
          failed={reporting.shareUrlStatsFailed}
        />
      )}
      {task.project && (
        <TaskProjectPanel
          projectId={task.project.id}
          taskId={task.id}
          setError={setError}
          onDeleted={() => (eventsRef.current ?? phaseRef.current)?.focus()}
        />
      )}
      {task.events.length > 0 && (
        <TaskEventsPanel events={task.events} now={now} listRef={eventsRef} />
      )}
    </>
  );
}
