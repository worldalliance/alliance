import { R } from "@alliance/common/result";
import { z } from "zod";
import type { LaunchSchedule } from "./launchSchedule";

const storedProgressSchema = z.object({
  memberActionAt: z.iso.datetime(),
  officeActionAt: z.iso.datetime(),
  readyActionVersions: z.array(z.tuple([z.number(), z.string()])),
  dismissedKeys: z.array(z.string()),
  acceptedViolations: z.array(z.string()),
});

export type LaunchProgress = {
  schedule: LaunchSchedule;
  /** Action id → the `reviewVersion` staff marked ready. */
  readyActionVersions: ReadonlyMap<number, string>;
  dismissedKeys: ReadonlySet<string>;
  acceptedViolations: ReadonlySet<string>;
};

const storageKey = (suiteId: number) => `alliance.suiteLaunch.v2.${suiteId}`;

export function readLaunchProgress(suiteId: number): LaunchProgress | null {
  if (typeof window === "undefined") return null;
  const read = R.fromThrowable(() =>
    window.localStorage.getItem(storageKey(suiteId)),
  );
  const raw = read.ok ? read.value : null;
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
    readyActionVersions: new Map(stored.data.readyActionVersions),
    dismissedKeys: new Set(stored.data.dismissedKeys),
    acceptedViolations: new Set(stored.data.acceptedViolations),
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
        readyActionVersions: [...progress.readyActionVersions],
        dismissedKeys: [...progress.dismissedKeys],
        acceptedViolations: [...progress.acceptedViolations],
      } satisfies z.infer<typeof storedProgressSchema>),
    ),
  );
}

export function clearLaunchProgress(suiteId: number): void {
  if (typeof window === "undefined") return;
  R.fromThrowable(() => window.localStorage.removeItem(storageKey(suiteId)));
}
