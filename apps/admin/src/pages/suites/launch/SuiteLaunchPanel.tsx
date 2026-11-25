import type { Result } from "@alliance/common/result";
import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { useState } from "react";
import { defaultReminderBodies } from "../../../components/reminders/presets";
import { contractViolations } from "../../../components/suite-launch/contractViolations";
import {
  eventBeforeDeadline,
  fixedChecklistDismissals,
  launchBlockers,
} from "../../../components/suite-launch/launchBlockers";
import { clearLaunchProgress } from "../../../components/suite-launch/launchProgress";
import { reminderSendWindows } from "../../../components/suite-launch/launchReminders";
import {
  completionTime,
  scheduleProblems,
} from "../../../components/suite-launch/launchSchedule";
import { launchSuite } from "../../../components/suite-launch/launchSuite";
import { actionMixes } from "../../../components/suite-launch/memberLoad";
import { useSuiteLaunchData } from "../../../components/suite-launch/useSuiteLaunchData";
import { formatDateTime } from "../../../lib/formatDate";
import { countOf } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { notifyRealMembersText } from "../../../lib/notifyRealMembers";
import { useActionReminderGroupsAdmin } from "../../../lib/useActionReminderGroupsAdmin";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import { Skeleton } from "../../../ui/Skeleton";
import { useToast } from "../../../ui/ToastProvider";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { ContractCheck } from "./ContractCheck";
import { LaunchSummary } from "./LaunchSummary";
import { MembersCheck } from "./MembersCheck";
import { RemindersCheck } from "./RemindersCheck";
import { ScheduleCheck } from "./ScheduleCheck";
import { TaskFormsCheck } from "./TaskFormsCheck";
import { TasksCheck } from "./TasksCheck";
import { TextCheck } from "./TextCheck";
import { useLaunchProgress } from "./useLaunchProgress";

const inPacific = (date: Date) =>
  formatDateTime(date, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

function Checking({ what }: { what: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
      <p role="status" className="text-fg-muted">
        {what}
      </p>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );
}

/**
 * The launch: today's checks in one column, and beside them what launch
 * creates, what blocks it, and the button. Nothing is created before staff
 * type the count of members it notifies.
 */
export default function SuiteLaunchPanel({
  suite,
  addEvent,
  fetchSuite,
  onClose,
}: {
  suite: ActionSuiteDto;
  /** Rereads the suite past the cache, so launch checks what the server has. */
  fetchSuite: () => Promise<Result<ActionSuiteDto, unknown>>;
  /** Resolves `null` when staff decline to move a deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  /** After a launch. */
  onClose: () => void;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const createReminders = useActionReminderGroupsAdmin(null).create;
  const progress = useLaunchProgress(suite.id);
  const { schedule, readyActionVersions, dismissedKeys } = progress;
  const data = useSuiteLaunchData({ suite, schedule });
  const reminderBodies = defaultReminderBodies({
    suiteId: suite.id,
    hasDeadline: true,
  });
  const reminderWindows = reminderSendWindows({
    bodies: reminderBodies,
    schedule,
  });
  const fixedDismissals =
    data.loading || data.errors.length > 0
      ? []
      : fixedChecklistDismissals(data.actions, dismissedKeys);
  // Set during render, React's pattern for state following other data, so a
  // fixed item never renders as dismissed.
  if (fixedDismissals.length > 0) progress.restore(fixedDismissals);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const violations = data.loading
    ? []
    : contractViolations({ loads: data.loads, schedule });
  const violationsAccepted = violations.every((violation) =>
    progress.acceptedViolations.has(violation),
  );
  const markedReady = data.actions.filter(({ action }) =>
    readyActionVersions.has(action.id),
  );
  // A failed load leaves parts out of a version, so a mark is taken as it is
  // until every check loads.
  const versionsKnown = data.errors.length === 0;
  const checkedActionIds = new Set(
    markedReady
      .filter(
        ({ action, reviewVersion }) =>
          !versionsKnown ||
          readyActionVersions.get(action.id) === reviewVersion,
      )
      .map(({ action }) => action.id),
  );
  const changedActionIds = new Set(
    markedReady
      .map(({ action }) => action.id)
      .filter((actionId) => !checkedActionIds.has(actionId)),
  );
  const now = new Date();
  const blockers = launchBlockers({
    data,
    schedule,
    reminderWindows,
    suiteEvents: suite.events,
    checkedActionIds,
    dismissedKeys,
    violations,
    violationsAcknowledged: violationsAccepted,
    now,
  });

  const handleLaunch = async () => {
    const { recipientCount } = data;
    if (recipientCount === null) {
      throw new Error("Launch ran with the member count unknown");
    }
    const groupLeadsNote = reminderBodies.some(
      (body) => body.cohortType === "group_leads_with_uncompleted",
    )
      ? " Group leads reminders also reach each unfinished member's group lead, counted only if they're assigned a task themselves."
      : "";
    const ok = await confirm({
      title: `Launch “${suite.name}”?`,
      message: `Members start ${inPacific(schedule.memberActionAt)} and have until ${inPacific(schedule.officeActionAt)}, ${completionTime(schedule)}. This creates both events and ${reminderBodies.length} reminders, notifying ${countOf(recipientCount, "member")}.${groupLeadsNote}`,
      confirmLabel: "Launch",
      requiredText: notifyRealMembersText(recipientCount),
    });
    if (!ok) return;
    if (schedule.memberActionAt <= new Date()) {
      setLaunchError(
        "Members taking action must start in the future. Pick a later time.",
      );
      return;
    }
    setLaunching(true);
    setLaunchError(null);
    const result = await launchSuite({
      fetchSuite,
      schedule,
      addEvent,
      reminderBodies,
      createReminders: createReminders.mutateAsync,
    });
    setLaunching(false);
    if (result.ok) {
      clearLaunchProgress(suite.id);
      success(`${suite.name} is scheduled to launch.`);
      onClose();
    } else {
      setLaunchError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-section @4xl:flex-row @4xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-section">
        {violations.length > 0 && (
          <ContractCheck
            violations={violations}
            accepted={violationsAccepted}
            onAcceptedChange={(accepted) =>
              progress.setAcceptedViolations(
                new Set(accepted ? violations : []),
              )
            }
          />
        )}
        {data.errors.length > 0 && (
          <Banner inline tone={BannerTone.Danger}>
            <p className="font-medium">
              Some checks couldn't load, so launch is blocked
            </p>
            <ul className="list-disc pl-5">
              {data.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Banner>
        )}
        <ScheduleCheck
          schedule={schedule}
          problems={scheduleProblems(schedule, now)}
          eventInWindow={eventBeforeDeadline(suite.events, schedule)}
          onChange={progress.setScheduleTime}
        />
        <RemindersCheck
          bodies={reminderBodies}
          windows={reminderWindows}
          schedule={schedule}
          timeZones={data.recipientTimeZones}
          mixes={actionMixes(data.loads ?? [])}
          actions={data.actions}
          users={data.users}
        />
        {data.loading ? (
          <Checking what="Running checks…" />
        ) : (
          <>
            <TasksCheck
              actions={data.actions}
              checkedActionIds={checkedActionIds}
              changedActionIds={changedActionIds}
              schedule={schedule}
              onCheckedChange={({ action, reviewVersion }, checked) =>
                progress.setReady({
                  actionId: action.id,
                  version: checked ? reviewVersion : null,
                })
              }
              dismissedKeys={dismissedKeys}
              onDismiss={progress.dismiss}
              onRestore={progress.restore}
            />
            <MembersCheck
              loads={data.loads}
              actions={data.actions}
              users={data.users}
              usersLoadFailed={data.usersLoadFailed}
            />
            <TaskFormsCheck actions={data.actions} />
            {data.spellcheckLoading ? (
              <Checking what="Loading the spelling dictionary…" />
            ) : (
              <TextCheck
                findings={data.textFindings}
                actions={data.actions}
                dismissedKeys={dismissedKeys}
                onDismiss={(key) => progress.dismiss([key])}
                onRestore={(key) => progress.restore([key])}
                onRecheck={data.refetch}
              />
            )}
          </>
        )}
      </div>
      <aside
        aria-label="Launch summary"
        className="shrink-0 @4xl:sticky @4xl:top-6 @4xl:w-80"
      >
        <LaunchSummary
          schedule={schedule}
          reminderCount={reminderBodies.length}
          recipientCount={data.recipientCount}
          taskCount={suite.actions.length}
          checking={data.loading || data.spellcheckLoading}
          blockers={blockers}
          launchError={launchError}
          launching={launching}
          notice={progress.notice}
          onLaunch={() => void handleLaunch()}
        />
      </aside>
    </div>
  );
}
