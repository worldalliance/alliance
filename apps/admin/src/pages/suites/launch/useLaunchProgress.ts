import { useLayoutEffect, useState } from "react";
import {
  readLaunchProgress,
  writeLaunchProgress,
} from "../../../components/suite-launch/launchProgress";
import {
  defaultLaunchSchedule,
  type LaunchSchedule,
} from "../../../components/suite-launch/launchSchedule";

export enum ProgressNotice {
  None = "none",
  /** Saved progress was there but couldn't be parsed, so this visit starts over. */
  Unreadable = "unreadable",
  /** Writing failed, so a reload starts over. */
  NotSaving = "not-saving",
}

const toggled = <T>(
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

/** The launch's picks and marks, kept in local storage so a reload keeps them. */
export function useLaunchProgress(suiteId: number) {
  const [read] = useState(() => readLaunchProgress(suiteId));
  const saved = read.ok ? read.value : null;
  const [saving, setSaving] = useState(true);
  const [defaultSchedule] = useState(() => defaultLaunchSchedule(new Date()));
  const [pickedSchedule, setPickedSchedule] = useState(() =>
    saved?.schedule && saved.schedule.memberActionAt > new Date()
      ? saved.schedule
      : null,
  );
  const [readyActionVersions, setReadyActionVersions] = useState<
    ReadonlyMap<number, string>
  >(saved?.readyActionVersions ?? new Map());
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(
    saved?.dismissedKeys ?? new Set(),
  );
  const [acceptedViolations, setAcceptedViolations] = useState<
    ReadonlySet<string>
  >(saved?.acceptedViolations ?? new Set());

  // Before paint, so blocked storage doesn't flash the "couldn't be read" notice.
  useLayoutEffect(() => {
    const written = writeLaunchProgress({
      suiteId,
      progress: {
        schedule: pickedSchedule,
        readyActionVersions,
        dismissedKeys,
        acceptedViolations,
      },
    });
    setSaving(written.ok);
  }, [
    suiteId,
    pickedSchedule,
    readyActionVersions,
    dismissedKeys,
    acceptedViolations,
  ]);

  const schedule = pickedSchedule ?? defaultSchedule;
  return {
    schedule,
    setScheduleTime: (field: keyof LaunchSchedule, at: Date) =>
      setPickedSchedule((prev) => ({
        ...(prev ?? defaultSchedule),
        [field]: at,
      })),
    readyActionVersions,
    setReady: (params: { actionId: number; version: string | null }) =>
      setReadyActionVersions((prev) => {
        const next = new Map(prev);
        if (params.version === null) next.delete(params.actionId);
        else next.set(params.actionId, params.version);
        return next;
      }),
    dismissedKeys,
    dismiss: (keys: string[]) =>
      setDismissedKeys((prev) => toggled(prev, { items: keys, on: true })),
    restore: (keys: string[]) =>
      setDismissedKeys((prev) => toggled(prev, { items: keys, on: false })),
    acceptedViolations,
    setAcceptedViolations,
    notice: !saving
      ? ProgressNotice.NotSaving
      : read.ok
        ? ProgressNotice.None
        : ProgressNotice.Unreadable,
  };
}
