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
import { useEffect, useState } from "react";
import { notifyRealMembersText } from "../../lib/notifyRealMembers";
import { useActionReminderGroupsAdmin } from "../../lib/useActionReminderGroupsAdmin";
import { defaultReminderBodies } from "../reminders/presets";
import { iconControlClass } from "./ActionLinks";
import ActionReviewCheck from "./ActionReviewCheck";
import { contractViolations } from "./contractViolations";
import ContractViolationsBanner from "./ContractViolationsBanner";
import { launchBlockers, LaunchSection } from "./launchBlockers";
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
  type LaunchSchedule,
} from "./launchSchedule";
import { launchSuite } from "./launchSuite";
import { MemberPreview } from "./MemberChecks";
import { actionMixes } from "./memberLoad";
import TextFindingsCheck from "./TextFindingsCheck";
import { useSuiteLaunchData } from "./useSuiteLaunchData";

const toggled = <T,>(set: ReadonlySet<T>, item: T, on: boolean) => {
  const next = new Set(set);
  if (on) next.add(item);
  else next.delete(item);
  return next;
};

const SuiteLaunchPanel = ({
  suite,
  addEvent,
  fetchSuite,
  onClose,
}: {
  suite: ActionSuiteDto;
  fetchSuite: () => Promise<ActionSuiteDto>;
  /** Resolves `null` when staff decline to move a deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  onClose: () => void;
}) => {
  const { confirm, success } = useToast();
  const createReminders = useActionReminderGroupsAdmin(null).create;
  const [saved] = useState(() => readLaunchProgress(suite.id));
  const [schedule, setSchedule] = useState<LaunchSchedule>(() =>
    saved && saved.schedule.memberActionAt > new Date()
      ? saved.schedule
      : defaultLaunchSchedule(new Date()),
  );
  const data = useSuiteLaunchData(suite);
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
  const [acceptedViolations, setAcceptedViolations] = useState<
    ReadonlySet<string>
  >(saved?.acceptedViolations ?? new Set());
  useEffect(() => {
    writeLaunchProgress({
      suiteId: suite.id,
      progress: {
        schedule,
        readyActionVersions,
        dismissedKeys,
        acceptedViolations,
      },
    });
  }, [
    suite.id,
    schedule,
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
        setSchedule((prev) => ({ ...prev, [field]: new Date(utcValue) }));
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
  const checkedActionIds = new Set(
    markedReady
      .filter(
        ({ action, reviewVersion }) =>
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
  const scheduleValid =
    schedule.memberActionAt > now &&
    schedule.officeActionAt > schedule.memberActionAt;
  const blockers = launchBlockers({
    data,
    schedule,
    reminderWindows,
    suiteEvents: suite.events,
    checkedActionIds,
    dismissedFindingKeys: dismissedKeys,
    violationsAcknowledged,
    now,
  });

  const handleLaunch = async () => {
    const ok = await confirm({
      title: "Launch suite?",
      message: `Members start ${inLaunchZone(schedule.memberActionAt)} and have until ${inLaunchZone(schedule.officeActionAt)}, ${completionTime(schedule)}. This creates both events and ${reminderBodies.length} reminders, notifying ${data.recipientCount} members.`,
      confirmLabel: "Launch",
      cancelLabel: "Cancel",
      mode: ConfirmMode.Fullscreen,
      requiredText: notifyRealMembersText(data.recipientCount),
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
      suiteId: suite.id,
      fetchSuite,
      schedule,
      addEvent,
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
        mixes={actionMixes(data.loads)}
        actions={data.actions}
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
            onDismiss={(key) =>
              setDismissedKeys((prev) => toggled(prev, key, true))
            }
            onRestore={(key) =>
              setDismissedKeys((prev) => toggled(prev, key, false))
            }
          />
          <MemberPreview loads={data.loads} actions={data.actions} />
          {data.spellcheckLoading ? (
            <p className="text-sm text-zinc-500">
              Loading the spelling dictionary…
            </p>
          ) : (
            <TextFindingsCheck
              findings={data.textFindings}
              actions={data.actions}
              dismissedKeys={dismissedKeys}
              onDismiss={(key) =>
                setDismissedKeys((prev) => toggled(prev, key, true))
              }
              onRestore={(key) =>
                setDismissedKeys((prev) => toggled(prev, key, false))
              }
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
      {launchError && <p className="text-sm text-red-500">{launchError}</p>}
      {violations.length > 0 && (
        <ContractViolationsBanner
          violations={violations}
          acknowledged={violationsAcknowledged}
          onAcknowledgedChange={(acknowledged) =>
            setAcceptedViolations(new Set(acknowledged ? violations : []))
          }
        />
      )}
      <Button
        color={ButtonColor.Green}
        size="large"
        className="w-full"
        disabled={blockers.length > 0 || launching}
        onClick={handleLaunch}
      >
        {launching
          ? "Launching…"
          : data.loading
            ? "Running checks…"
            : `Launch and notify ${data.recipientCount} members`}
      </Button>
    </section>
  );
};

export default SuiteLaunchPanel;
