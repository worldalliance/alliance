import { R, type Result } from "@alliance/common/result";
import { z } from "zod";
import type { LaunchSchedule } from "./launchSchedule";

const storedProgressSchema = z.object({
  memberActionAt: z.iso.datetime(),
  officeActionAt: z.iso.datetime(),
  checkedActionIds: z.array(z.number()),
  dismissedKeys: z.array(z.string()),
  violationsAcknowledged: z.boolean(),
});

export type LaunchProgress = {
  schedule: LaunchSchedule;
  checkedActionIds: ReadonlySet<number>;
  dismissedKeys: ReadonlySet<string>;
  violationsAcknowledged: boolean;
};

const storageKey = (suiteId: number) => `alliance.suiteLaunch.v1.${suiteId}`;

/** `null` when nothing is saved for the suite. */
export function readLaunchProgress(
  suiteId: number,
): Result<LaunchProgress | null, Error> {
  const raw = window.localStorage.getItem(storageKey(suiteId));
  if (raw === null) return R.success(null);
  const parsed = R.fromThrowable(() =>
    storedProgressSchema.parse(JSON.parse(raw)),
  );
  return R.map(parsed, (stored) => ({
    schedule: {
      memberActionAt: new Date(stored.memberActionAt),
      officeActionAt: new Date(stored.officeActionAt),
    },
    checkedActionIds: new Set(stored.checkedActionIds),
    dismissedKeys: new Set(stored.dismissedKeys),
    violationsAcknowledged: stored.violationsAcknowledged,
  }));
}

export function writeLaunchProgress(params: {
  suiteId: number;
  progress: LaunchProgress;
}): void {
  const { suiteId, progress } = params;
  R.fromThrowable(() =>
    window.localStorage.setItem(
      storageKey(suiteId),
      JSON.stringify({
        memberActionAt: progress.schedule.memberActionAt.toISOString(),
        officeActionAt: progress.schedule.officeActionAt.toISOString(),
        checkedActionIds: [...progress.checkedActionIds],
        dismissedKeys: [...progress.dismissedKeys],
        violationsAcknowledged: progress.violationsAcknowledged,
      } satisfies z.infer<typeof storedProgressSchema>),
    ),
  );
}

export function clearLaunchProgress(suiteId: number): void {
  window.localStorage.removeItem(storageKey(suiteId));
}
