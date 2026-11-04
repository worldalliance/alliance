import { R, type Result } from "@alliance/common/result";
import { z } from "zod";
import type { LaunchSchedule } from "./launchSchedule";

const storedProgressSchema = z.object({
  schedule: z
    .object({
      memberActionAt: z.iso.datetime(),
      officeActionAt: z.iso.datetime(),
    })
    .nullable(),
  readyActionVersions: z.array(z.tuple([z.number(), z.string()])),
  dismissedKeys: z.array(z.string()),
  acceptedViolations: z.array(z.string()),
});

export type LaunchProgress = {
  /** `null` until staff edit it, so each visit pre-fills the default afresh. */
  schedule: LaunchSchedule | null;
  /** Action id → the `reviewVersion` staff marked ready. */
  readyActionVersions: ReadonlyMap<number, string>;
  dismissedKeys: ReadonlySet<string>;
  acceptedViolations: ReadonlySet<string>;
};

const storageKey = (suiteId: number) => `alliance.suiteLaunch.v2.${suiteId}`;

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
    schedule: stored.schedule && {
      memberActionAt: new Date(stored.schedule.memberActionAt),
      officeActionAt: new Date(stored.schedule.officeActionAt),
    },
    readyActionVersions: new Map(stored.readyActionVersions),
    dismissedKeys: new Set(stored.dismissedKeys),
    acceptedViolations: new Set(stored.acceptedViolations),
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
        schedule: progress.schedule && {
          memberActionAt: progress.schedule.memberActionAt.toISOString(),
          officeActionAt: progress.schedule.officeActionAt.toISOString(),
        },
        readyActionVersions: [...progress.readyActionVersions],
        dismissedKeys: [...progress.dismissedKeys],
        acceptedViolations: [...progress.acceptedViolations],
      } satisfies z.infer<typeof storedProgressSchema>),
    ),
  );
}

export function clearLaunchProgress(suiteId: number): void {
  window.localStorage.removeItem(storageKey(suiteId));
}
