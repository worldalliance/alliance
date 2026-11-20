import { R } from "@alliance/common/result";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { blockResumeRestartUntil } from "./resumeRestarts";

const KEY = "handledPushTaps";
// Far more taps than a member opens in one app process, so every tap Android
// replays is still listed.
export const KEPT_PUSH_TAPS = 50;

async function readHandled(report: (error: unknown) => void) {
  const raw = await R.fromPromise(AsyncStorage.getItem(KEY));
  if (R.isFailure(raw)) {
    report(raw.error);
    return [];
  }
  const text = raw.value;
  if (text === null) return [];
  const json = R.fromThrowable((): unknown => JSON.parse(text));
  const handled = z.array(z.string()).safeParse(R.toNullable(json));
  if (handled.success) return handled.data;
  report(R.isFailure(json) ? json.error : handled.error);
  return [];
}

/**
 * Tells new push taps from ones seen before. expo-notifications can deliver a
 * tap at launch and again to its listener, and on Android replays taps that
 * arrived before its listener after every reload, so taps whose action ran
 * are kept across restarts. A tap seen but not yet acted on, such as one waiting for
 * sign-in, passes again after a restart. An automatic restart waits for a
 * tap's handled mark to be saved, so it can't replay the tap. A storage
 * failure is reported and falls back to this session's taps.
 */
export function handledPushTaps(report: (error: unknown) => void): {
  isNew: (identifier: string) => Promise<boolean>;
  markHandled: (identifier: string) => Promise<void>;
} {
  const seen = new Set<string>();
  let handled: Promise<string[]> | null = null;
  let saving = Promise.resolve();
  const read = () => (handled ??= readHandled(report));
  return {
    isNew: async (identifier) => {
      if (seen.has(identifier)) return false;
      seen.add(identifier);
      return !(await read()).includes(identifier);
    },
    markHandled: (identifier) => {
      saving = saving.then(async () => {
        const kept = await read();
        if (kept.includes(identifier)) return;
        const next = [...kept, identifier].slice(-KEPT_PUSH_TAPS);
        handled = Promise.resolve(next);
        const saved = await R.fromPromise(
          AsyncStorage.setItem(KEY, JSON.stringify(next)),
        );
        if (R.isFailure(saved)) report(saved.error);
      });
      blockResumeRestartUntil(saving);
      return saving;
    },
  };
}

/**
 * Runs each new tap once `canRun` allows, the last one waiting while it
 * doesn't. A tap is marked handled when it runs or a later tap replaces it,
 * so one still waiting for sign-in opens after a restart.
 */
export function pushTapRunner<T extends { tapId: string }>(params: {
  taps: ReturnType<typeof handledPushTaps>;
  canRun: () => boolean;
}): {
  /** Resolves whether the tap is new. */
  arrive: (tap: T, run: (tap: T) => void) => Promise<boolean>;
  resume: (run: (tap: T) => void) => void;
} {
  let waiting: T | null = null;
  const runNow = (tap: T, run: (tap: T) => void) => {
    void params.taps.markHandled(tap.tapId);
    run(tap);
  };
  return {
    arrive: async (tap, run) => {
      if (!(await params.taps.isNew(tap.tapId))) return false;
      if (params.canRun()) runNow(tap, run);
      else {
        if (waiting !== null) void params.taps.markHandled(waiting.tapId);
        waiting = tap;
      }
      return true;
    },
    resume: (run) => {
      if (waiting === null || !params.canRun()) return;
      const tap = waiting;
      waiting = null;
      runNow(tap, run);
    },
  };
}
