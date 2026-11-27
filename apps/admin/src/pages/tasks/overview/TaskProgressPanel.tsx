import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import type { RefObject } from "react";
import { formatDateTime } from "../../../lib/formatDate";
import { formatCount } from "../../../lib/formatNumber";
import Button, { ButtonVariant } from "../../../ui/Button";
import PhaseBadge, { phaseLabel } from "../../../ui/PhaseBadge";
import { Panel, PanelNote, PanelStat } from "../../../ui/templates/Overview";
import type { ActionReporting } from "../../action-dashboard/useActionReporting";
import type { TaskTabProps } from "../taskTabs";
import {
  notStartedNote,
  percentOf,
  ReportStage,
  reportStage,
} from "./overviewRules";

const count = (value: number | null | undefined) =>
  value == null ? "—" : formatCount(value);

/**
 * The task's phase, which opens Events, and how far members have got: what
 * the server counts, nothing more. A task members haven't started says why
 * there is nothing yet.
 */
export function TaskProgressPanel({
  task,
  reporting,
  openTab,
  now,
  phaseRef,
}: {
  task: ParsedActionDto;
  reporting: ActionReporting;
  openTab: TaskTabProps["openTab"];
  now: Date;
  phaseRef: RefObject<HTMLButtonElement | null>;
}) {
  const stage = reportStage(task, now);
  return (
    <Panel
      title="Progress"
      action={
        <Button
          ref={phaseRef}
          variant={ButtonVariant.Ghost}
          size="small"
          aria-label={`${phaseLabel(task.status)}: open events`}
          title="Open events"
          onClick={() => openTab("events")}
        >
          <PhaseBadge status={task.status} />
        </Button>
      }
    >
      {stage === ReportStage.Started ? (
        <Participation task={task} reporting={reporting} />
      ) : (
        <NothingYet task={task} stage={stage} openTab={openTab} now={now} />
      )}
    </Panel>
  );
}

function NothingYet({
  task,
  stage,
  openTab,
  now,
}: {
  task: ParsedActionDto;
  stage: ReportStage.Draft | ReportStage.NotStarted;
  openTab: TaskTabProps["openTab"];
  now: Date;
}) {
  switch (stage) {
    case ReportStage.Draft:
      return (
        <div className="flex flex-col items-start gap-3">
          <PanelNote>
            It has no events yet. Completion, withdrawals and responses show
            here once members start taking it. What it still needs before launch
            is on Details.
          </PanelNote>
          <Button
            variant={ButtonVariant.Default}
            size="small"
            onClick={() => openTab("details")}
          >
            Open details
          </Button>
        </div>
      );
    case ReportStage.NotStarted:
      return <PanelNote>{notStartedNote(task, now)}</PanelNote>;
    default:
      throw new Error(`unknown stage: ${stage satisfies never}`);
  }
}

function Participation({
  task,
  reporting,
}: {
  task: ParsedActionDto;
  reporting: ActionReporting;
}) {
  const { actionStats, actionStatsLoading, actionStatsNotCounted } = reporting;
  const completed = percentOf(task.usersCompleted, task.usersJoined);
  const snapshot = actionStats
    ? `Counted ${formatDateTime(actionStats.lastCalculatedAt)}`
    : actionStatsLoading
      ? "Loading…"
      : actionStatsNotCounted
        ? "Not counted yet: counted daily at 9:00 UTC"
        : "Couldn't load";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
        <PanelStat
          label={task.optional ? "Able to complete" : "Expected to complete"}
          value={formatCount(task.usersJoined)}
        />
        <PanelStat
          label="Completed"
          value={formatCount(task.usersCompleted)}
          note={
            completed === null ? undefined : `${completed}% completion rate`
          }
        />
        <PanelStat
          label="Withdrawn"
          value={count(actionStats?.usersWithdrawn)}
          note={snapshot}
        />
        {task.optional ? (
          <PanelStat
            label="Dismissed"
            value={count(actionStats?.usersDismissed)}
            note={snapshot}
          />
        ) : (
          reporting.listsIncompleteUsers && (
            <PanelStat
              label="Failed to complete"
              value={
                reporting.incompleteUsersLoading ||
                reporting.incompleteUsersFailed
                  ? "—"
                  : formatCount(reporting.incompleteUsers.length)
              }
              note={
                reporting.incompleteUsersLoading
                  ? "Loading…"
                  : reporting.incompleteUsersFailed
                    ? "Couldn't load"
                    : undefined
              }
            />
          )
        )}
      </div>
      {completed !== null && (
        <div
          role="meter"
          aria-label="Completion progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(completed, 100)}
          aria-valuetext={`${formatCount(task.usersCompleted)} of ${formatCount(task.usersJoined)} completed (${completed}%)`}
          className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${Math.min(completed, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
