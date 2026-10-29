import { withCount } from "@alliance/common/plural";
import type { Result } from "@alliance/common/result";
import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import DateTimePicker, {
  type DateTimePickerChange,
} from "@alliance/sharedweb/ui/DateTimePicker";
import { ConfirmMode, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ArrowLeft } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { notifyRealMembersText } from "../../lib/notifyRealMembers";
import { useActionReminderGroupsAdmin } from "../../lib/useActionReminderGroupsAdmin";
import { defaultReminderBodies } from "../reminders/presets";
import { iconControlClass } from "./ActionLinks";
import ActionReviewCheck from "./ActionReviewCheck";
import { contractViolations } from "./contractViolations";
import ContractViolationsBanner from "./ContractViolationsBanner";
import {
  fixedChecklistDismissals,
  launchBlockers,
  LaunchSection,
} from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import {
  clearLaunchProgress,
  readLaunchProgress,
  writeLaunchProgress,
} from "./launchProgress";
import { reminderSendWindows } from "./launchReminders";
import LaunchRemindersCheck from "./LaunchRemindersCheck";
import {
  completionTime,
  defaultLaunchSchedule,
  inLaunchZone,
  scheduleProblems,
  type LaunchSchedule,
} from "./launchSchedule";
import { launchSuite } from "./launchSuite";
import { MemberPreview } from "./MemberChecks";
import { actionMixes } from "./memberLoad";
import TextFindingsCheck from "./TextFindingsCheck";
import { useSuiteLaunchData } from "./useSuiteLaunchData";

const toggled = <T,>(
  set: ReadonlySet<T>,
  { items, on }: { items: T[]; on: boolean },
) => {
  const next = new Set(set);
  for (const item of items) {
    if (on) next.add(item);
    else next.delete(item);
  }
  return next;
};

const SuiteLaunchPanel = ({
  suite,
  addEvent,
  fetchSuite,
  onClose,
}: {
  suite: ActionSuiteDto;
  fetchSuite: () => Promise<Result<ActionSuiteDto, Error>>;
  /** Resolves `null` when staff decline to move a deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  onClose: () => void;
}) => {
  const { confirm, success } = useToast();
  const createReminders = useActionReminderGroupsAdmin(null).create;
  const [read] = useState(() => readLaunchProgress(suite.id));
  const saved = read.ok ? read.value : null;
  const [saving, setSaving] = useState(true);
  const [defaultSchedule] = useState(() => defaultLaunchSchedule(new Date()));
  const [pickedSchedule, setPickedSchedule] = useState(() =>
    saved?.schedule && saved.schedule.memberActionAt > new Date()
      ? saved.schedule
      : null,
  );
  const schedule = pickedSchedule ?? defaultSchedule;
  const data = useSuiteLaunchData({ suite, schedule });
  const reminderBodies = defaultReminderBodies({
    suiteId: suite.id,
    hasDeadline: true,
  });
  const reminderWindows = reminderSendWindows({
    bodies: reminderBodies,
    schedule,
  });
  const [readyActionVersions, setReadyActionVersions] = useState<
    ReadonlyMap<number, string>
  >(saved?.readyActionVersions ?? new Map());
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(
    saved?.dismissedKeys ?? new Set(),
  );
  const dismiss = (keys: string[]) =>
    setDismissedKeys((prev) => toggled(prev, { items: keys, on: true }));
  const restore = (keys: string[]) =>
    setDismissedKeys((prev) => toggled(prev, { items: keys, on: false }));
  const fixedDismissals =
    data.loading || data.errors.length > 0
      ? []
      : fixedChecklistDismissals(data.actions, dismissedKeys);
  // Set during render, React's pattern for state following other data, so a
  // fixed item never renders as dismissed.
  if (fixedDismissals.length > 0) restore(fixedDismissals);
  const [acceptedViolations, setAcceptedViolations] = useState<
    ReadonlySet<string>
  >(saved?.acceptedViolations ?? new Set());
  // Before paint, so blocked storage doesn't flash the "couldn't be read" notice.
  useLayoutEffect(() => {
    const written = writeLaunchProgress({
      suiteId: suite.id,
      progress: {
        schedule: pickedSchedule,
        readyActionVersions,
        dismissedKeys,
        acceptedViolations,
      },
    });
    setSaving(written.ok);
  }, [
    suite.id,
    pickedSchedule,
    readyActionVersions,
    dismissedKeys,
    acceptedViolations,
  ]);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const setScheduleTime =
    (field: keyof LaunchSchedule) =>
    ({ utcValue }: DateTimePickerChange) => {
      if (utcValue) {
        setPickedSchedule((prev) => ({
          ...(prev ?? defaultSchedule),
          [field]: new Date(utcValue),
        }));
      }
    };

  const violations = data.loading
    ? []
    : contractViolations({ loads: data.loads, schedule });
  const violationsAcknowledged = violations.every((violation) =>
    acceptedViolations.has(violation),
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
  const scheduleValid = scheduleProblems(schedule, now).length === 0;
  const blockers = launchBlockers({
    data,
    schedule,
    reminderWindows,
    suiteEvents: suite.events,
    checkedActionIds,
    dismissedKeys,
    violations,
    violationsAcknowledged,
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
      ? " Group leads reminders also reach each unfinished member's group lead, counted only if they're assigned an action themselves."
      : "";
    const ok = await confirm({
      title: "Launch suite?",
      message: `Members start ${inLaunchZone(schedule.memberActionAt)} and have until ${inLaunchZone(schedule.officeActionAt)}, ${completionTime(schedule)}. This creates both events and ${reminderBodies.length} reminders, notifying ${withCount(recipientCount, "member")}.${groupLeadsNote}`,
      confirmLabel: "Launch",
      cancelLabel: "Cancel",
      mode: ConfirmMode.Fullscreen,
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
    <section className="flex flex-col gap-4 rounded-lg border-2 border-green p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to suite"
          title="Back to suite"
          className={iconControlClass}
        >
          <ArrowLeft className="size-5" />
        </button>
        <h2 className="text-lg font-semibold">Launch {suite.name}</h2>
      </div>
      {saving ? (
        !read.ok && (
          <p className="text-sm text-yellow-800">
            {"Saved launch progress couldn't be read, so this starts over."}
          </p>
        )
      ) : (
        <p className="text-sm text-yellow-800">
          {
            "This browser isn't saving launch progress, so a reload starts over."
          }
        </p>
      )}

      <LaunchCheck
        id={LaunchSection.Schedule}
        title="Schedule"
        passed={scheduleValid}
      >
        {scheduleValid && (
          <p className="text-sm text-black">
            Members have {completionTime(schedule)} to complete their actions
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Members taking action
            <DateTimePicker
              value={schedule.memberActionAt}
              onChange={setScheduleTime("memberActionAt")}
            />
            <span className="text-xs text-zinc-500">
              {inLaunchZone(schedule.memberActionAt)}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Office taking action
            <DateTimePicker
              value={schedule.officeActionAt}
              onChange={setScheduleTime("officeActionAt")}
            />
            <span className="text-xs text-zinc-500">
              {inLaunchZone(schedule.officeActionAt)}
            </span>
          </label>
        </div>
      </LaunchCheck>
      <LaunchRemindersCheck
        bodies={reminderBodies}
        windows={reminderWindows}
        schedule={schedule}
        timeZones={data.recipientTimeZones}
        mixes={actionMixes(data.loads ?? [])}
        actions={data.actions}
        users={data.users}
      />

      {data.errors.length > 0 && (
        <ul className="text-sm text-red-500">
          {data.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {data.loading ? (
        <p className="text-sm text-zinc-500">Running checks…</p>
      ) : (
        <>
          <ActionReviewCheck
            actions={data.actions}
            checkedActionIds={checkedActionIds}
            changedActionIds={changedActionIds}
            schedule={schedule}
            onCheckedChange={({ action, reviewVersion }, checked) =>
              setReadyActionVersions((prev) => {
                const next = new Map(prev);
                if (checked) next.set(action.id, reviewVersion);
                else next.delete(action.id);
                return next;
              })
            }
            dismissedKeys={dismissedKeys}
            onDismiss={dismiss}
            onRestore={restore}
          />
          <MemberPreview
            loads={data.loads}
            actions={data.actions}
            users={data.users}
            usersLoadFailed={data.usersLoadFailed}
          />
          {data.spellcheckLoading ? (
            <p className="text-sm text-zinc-500">
              Loading the spelling dictionary…
            </p>
          ) : (
            <TextFindingsCheck
              findings={data.textFindings}
              actions={data.actions}
              dismissedKeys={dismissedKeys}
              onDismiss={(key) => dismiss([key])}
              onRestore={(key) => restore([key])}
              onRecheck={data.refetch}
            />
          )}
        </>
      )}

      {blockers.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-yellow-800">
          {blockers.map(({ message, section }) => (
            <li key={message}>
              {section ? (
                <button
                  type="button"
                  className="text-left underline"
                  onClick={() =>
                    document
                      .getElementById(section)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {message}
                </button>
              ) : (
                message
              )}
            </li>
          ))}
        </ul>
      )}
      {violations.length > 0 && (
        <ContractViolationsBanner
          violations={violations}
          acknowledged={violationsAcknowledged}
          onAcknowledgedChange={(acknowledged) =>
            setAcceptedViolations(new Set(acknowledged ? violations : []))
          }
        />
      )}
      {launchError && <p className="text-sm text-red-500">{launchError}</p>}
      <Button
        color={ButtonColor.Green}
        size="large"
        className="w-full"
        disabled={blockers.length > 0 || launching}
        onClick={handleLaunch}
      >
        {launching
          ? "Launching…"
          : data.loading || data.spellcheckLoading
            ? "Running checks…"
            : data.recipientCount === null
              ? "Launch and notify ? members"
              : `Launch and notify ${withCount(data.recipientCount, "member")}`}
      </Button>
    </section>
  );
};

export default SuiteLaunchPanel;
