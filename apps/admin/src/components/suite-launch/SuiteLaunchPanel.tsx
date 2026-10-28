import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import DateTimePicker, {
  type DateTimePickerChange,
} from "@alliance/sharedweb/ui/DateTimePicker";
import { ConfirmMode, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Rocket, X } from "lucide-react";
import { useState } from "react";
import { notifyRealMembersText } from "../../lib/notifyRealMembers";
import { useActionReminderGroupsAdmin } from "../../lib/useActionReminderGroupsAdmin";
import { defaultReminderBodies } from "../reminders/presets";
import { iconControlClass } from "./ActionLinks";
import ActionReviewCheck from "./ActionReviewCheck";
import { launchBlockers } from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import { reminderSendWindows } from "./launchReminders";
import LaunchRemindersCheck from "./LaunchRemindersCheck";
import {
  defaultLaunchSchedule,
  inLaunchZone,
  type LaunchSchedule,
} from "./launchSchedule";
import { launchSuite } from "./launchSuite";
import { MemberLoadCheck, MemberPreview } from "./MemberChecks";
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
  onClose,
}: {
  suite: ActionSuiteDto;
  /** Resolves `null` when staff decline to move a deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  onClose: () => void;
}) => {
  const { confirm, success } = useToast();
  const createReminders = useActionReminderGroupsAdmin(null).create;
  const [schedule, setSchedule] = useState<LaunchSchedule>(() =>
    defaultLaunchSchedule(new Date()),
  );
  const data = useSuiteLaunchData(suite, schedule);
  const reminderWindows = reminderSendWindows({
    bodies: defaultReminderBodies({ suiteId: suite.id, hasDeadline: true }),
    schedule,
  });
  const [checkedActionIds, setCheckedActionIds] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [overloadAcknowledged, setOverloadAcknowledged] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const setScheduleTime =
    (field: keyof LaunchSchedule) =>
    ({ utcValue }: DateTimePickerChange) => {
      if (utcValue) {
        setSchedule((prev) => ({ ...prev, [field]: new Date(utcValue) }));
      }
    };

  const now = new Date();
  const scheduleValid =
    schedule.memberActionAt > now &&
    schedule.officeActionAt > schedule.memberActionAt;
  const blockers = launchBlockers({
    data,
    schedule,
    reminderWindows,
    hasMemberActionEvent: suite.events.some(
      (event) => event.newStatus === "member_action",
    ),
    checkedActionIds,
    dismissedFindingKeys: dismissedKeys,
    overloadAcknowledged,
    now,
  });

  const handleLaunch = async () => {
    const ok = await confirm({
      title: "Launch suite?",
      message: `This creates the members taking action and office taking action events and the default reminders, which will notify ${data.recipientCount} members.`,
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
      suite,
      schedule,
      addEvent,
      createReminders: createReminders.mutateAsync,
    });
    setLaunching(false);
    if (result.ok) {
      success(`${suite.name} is scheduled to launch.`);
      onClose();
    } else {
      setLaunchError(result.error);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border-2 border-green p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Launch {suite.name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close launch process"
          title="Close launch process"
          className={iconControlClass}
        >
          <X className="size-5" />
        </button>
      </div>

      <LaunchCheck title="Schedule" passed={scheduleValid}>
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
      <LaunchRemindersCheck windows={reminderWindows} schedule={schedule} />

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
            onCheckedChange={(actionId, checked) =>
              setCheckedActionIds((prev) => toggled(prev, actionId, checked))
            }
          />
          <MemberLoadCheck
            loads={data.loads}
            actions={data.actions}
            otherActions={data.otherActions}
            acknowledged={overloadAcknowledged}
            onAcknowledgedChange={setOverloadAcknowledged}
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
              onRecheck={data.refetch}
            />
          )}
        </>
      )}

      {blockers.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-yellow-800">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
      {launchError && <p className="text-sm text-red-500">{launchError}</p>}
      <Button
        color={ButtonColor.Green}
        size="large"
        className="gap-2"
        disabled={blockers.length > 0 || launching}
        onClick={handleLaunch}
      >
        <Rocket className="size-5" />
        {launching
          ? "Launching…"
          : `Launch and notify ${data.recipientCount} members`}
      </Button>
    </section>
  );
};

export default SuiteLaunchPanel;
