import type { LaunchBlocker } from "../../../components/suite-launch/launchBlockers";
import type { LaunchSchedule } from "../../../components/suite-launch/launchSchedule";
import { formatDateTime } from "../../../lib/formatDate";
import { countOf, formatCount } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Panel } from "../../../ui/templates/Overview";
import { Fact, FactList } from "../../../ui/templates/Record";
import { ProgressNotice } from "./useLaunchProgress";

const inPacific = (date: Date) =>
  formatDateTime(date, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

const NOTICE: Record<ProgressNotice, string> = {
  [ProgressNotice.None]:
    "Progress on this page is saved in this browser, so a reload keeps it.",
  [ProgressNotice.NotSaving]:
    "This browser isn't saving launch progress, so a reload starts over.",
  [ProgressNotice.Unreadable]:
    "Saved launch progress couldn't be read, so this starts over.",
};

const jumpTo = (section: string) =>
  document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });

/** What launch creates, what stops it, and the one button that does it. */
export function LaunchSummary({
  schedule,
  reminderCount,
  recipientCount,
  taskCount,
  checking,
  blockers,
  launchError,
  launching,
  notice,
  onLaunch,
}: {
  schedule: LaunchSchedule;
  reminderCount: number;
  /** Null until every member count loads. */
  recipientCount: number | null;
  taskCount: number;
  checking: boolean;
  blockers: LaunchBlocker[];
  launchError: string | null;
  launching: boolean;
  notice: ProgressNotice;
  onLaunch: () => void;
}) {
  const blocked = blockers.length > 0;
  return (
    <Panel title="Launch">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-fg-muted">Launch creates, in order:</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>
              The members taking action event,{" "}
              <span className="font-medium">
                {inPacific(schedule.memberActionAt)}
              </span>
            </li>
            <li>
              The office taking action event, members' deadline,{" "}
              <span className="font-medium">
                {inPacific(schedule.officeActionAt)}
              </span>
            </li>
            <li>
              {countOf(reminderCount, "default reminder")} on the members taking
              action event
            </li>
          </ol>
          <p className="text-caption text-fg-muted">
            Every task in the suite gets both events.
          </p>
        </div>
        <FactList>
          <Fact label="Members">
            <span className="tabular-nums">
              {recipientCount === null ? "—" : formatCount(recipientCount)}
            </span>
          </Fact>
          <Fact label="Tasks">
            <span className="tabular-nums">{formatCount(taskCount)}</span>
          </Fact>
        </FactList>
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          {blocked ? (
            <>
              <p className="font-medium text-danger">
                {blockers.length === 1
                  ? "1 thing blocks launch"
                  : `${formatCount(blockers.length)} things block launch`}
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-danger">
                {blockers.map(({ message, section }) => (
                  <li key={message}>
                    {section ? (
                      <button
                        type="button"
                        className="rounded-sm text-left underline focus-ring"
                        onClick={() => jumpTo(section)}
                      >
                        {message}
                      </button>
                    ) : (
                      message
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-medium text-success">
              Every check passes. Launching asks you to confirm first.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {launchError && (
            <p role="alert" className="text-danger">
              {launchError}
            </p>
          )}
          <Button
            variant={ButtonVariant.Primary}
            className="w-full justify-center"
            disabled={blocked}
            busy={launching}
            onClick={onLaunch}
          >
            {checking
              ? "Running checks…"
              : recipientCount === null
                ? "Launch and notify — members…"
                : `Launch and notify ${countOf(recipientCount, "member")}…`}
          </Button>
          <p
            className={cn(
              "text-caption",
              notice === ProgressNotice.None ? "text-fg-muted" : "text-warning",
            )}
          >
            {NOTICE[notice]}
          </p>
        </div>
      </div>
    </Panel>
  );
}
