import { R } from "@alliance/common/result";
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

export function readLaunchProgress(suiteId: number): LaunchProgress | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(suiteId));
  if (!raw) return null;
  const parsed = R.fromThrowable(() => JSON.parse(raw));
  if (!parsed.ok) return null;
  const stored = storedProgressSchema.safeParse(parsed.value);
  if (!stored.success) return null;
  return {
    schedule: {
      memberActionAt: new Date(stored.data.memberActionAt),
      officeActionAt: new Date(stored.data.officeActionAt),
    },
    checkedActionIds: new Set(stored.data.checkedActionIds),
    dismissedKeys: new Set(stored.data.dismissedKeys),
    violationsAcknowledged: stored.data.violationsAcknowledged,
  };
}

export function writeLaunchProgress(params: {
  suiteId: number;
  progress: LaunchProgress;
}): void {
  if (typeof window === "undefined") return;
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
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(suiteId));
}
