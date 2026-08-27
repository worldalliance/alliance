import {
  AnalyticsEvent,
  ExceptionEvent,
  SEND_TO_SLACK,
  SLACK_PROPERTY,
} from "@alliance/common/analytics";
import { R } from "@alliance/common/result";
import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: JsonValue }
  | JsonValue[];

export type AnalyticsProperties = Record<string, JsonValue>;

export interface AnalyticsBackend {
  capture(event: string, properties?: AnalyticsProperties): void;
  captureException(error: unknown, properties?: AnalyticsProperties): void;
  /** Sends whatever is queued in memory. Backends that can't be flushed omit it. */
  flush?(): Promise<void>;
}

// Until a real backend is registered (on mobile this happens in an effect,
// after the first render), buffer calls instead of dropping them so early
// events aren't lost.
const MAX_BUFFERED_CALLS = 100;
let pending: Array<(b: AnalyticsBackend) => void> = [];
// Warn on first overflow.
let hasWarnedOverflow = false;

function enqueue(replay: (b: AnalyticsBackend) => void): void {
  if (pending.length >= MAX_BUFFERED_CALLS) {
    if (!hasWarnedOverflow && process.env.NODE_ENV !== "production") {
      hasWarnedOverflow = true;

      console.warn(
        `[analytics] Buffered ${MAX_BUFFERED_CALLS} events without a backend; ` +
          `dropping oldest. Did you forget to call registerAnalytics() at app startup?`,
      );
    }
    pending.shift();
  }
  pending.push(replay);
}

const bufferingBackend: AnalyticsBackend = {
  capture: (event, properties) => {
    enqueue((b) => b.capture(event, properties));
  },
  captureException: (error, properties) => {
    enqueue((b) => b.captureException(error, properties));
  },
};

let backend: AnalyticsBackend = bufferingBackend;

// posthog's `capture` propagates whatever it throws — @posthog/core's `wrap`
// re-throws by design — so a broken backend would otherwise take down the code
// that was only trying to report on itself.
function report(send: (b: AnalyticsBackend) => void, what: string): void {
  try {
    send(backend);
  } catch (error) {
    console.warn(`[analytics] ${what} failed`, error);
  }
}

/** Wires {@link captureEvent}/{@link captureException} to a platform's posthog client. Call once at app startup, next to posthog init. */
export function registerAnalytics(b: AnalyticsBackend): void {
  backend = b;
  hasWarnedOverflow = false;
  const queued = pending;
  pending = [];
  for (const replay of queued) {
    report(() => replay(b), "replay");
  }
}

/**
 * Test-only. Puts the module back in the state it starts a process in.
 *
 * @internal
 */
export function __resetAnalyticsForTests(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("__resetAnalyticsForTests called outside of tests");
  }

  backend = bufferingBackend;
  pending = [];
  hasWarnedOverflow = false;
}

/** Sends a strongly-typed event to posthog (wired up per-platform via {@link registerAnalytics}). Never throws. */
export function captureEvent(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties,
): void {
  report(
    (b) =>
      b.capture(event, {
        ...properties,
        [SLACK_PROPERTY]: SEND_TO_SLACK[event],
      }),
    event,
  );
}

export enum FlushOutcome {
  /** The backend sent what it had queued. */
  Flushed = "flushed",
  /** timeoutMs ran out first. The send may still be in flight. */
  TimedOut = "timed-out",
  /** The backend's flush rejected or threw. */
  Failed = "failed",
  /** No backend is registered, so nothing captured so far can be sent. */
  NoBackend = "no-backend",
  /** The backend exposes no flush, so whatever it queues is out of reach. */
  Unsupported = "unsupported",
}

/**
 * `error` accompanies {@link FlushOutcome.Failed} and only that outcome. The
 * other member declares it as `undefined` rather than leaving it off, so a
 * caller can destructure `error` without narrowing the union first.
 */
export type FlushResult =
  | { outcome: Exclude<FlushOutcome, FlushOutcome.Failed>; error?: undefined }
  | { outcome: FlushOutcome.Failed; error: Error };

/**
 * Sends whatever the backend still holds in memory, for callers about to tear
 * the runtime down. Resolves after `timeoutMs` whether or not the send
 * finished, and never rejects or logs. A caller one line away from reloading
 * the app can't do anything with a flush failure except delay the reload. It
 * gets a {@link FlushResult} instead, so a timeout or a failure is loggable
 * rather than looking like a successful send.
 */
export async function flushAnalytics(timeoutMs: number): Promise<FlushResult> {
  if (backend === bufferingBackend) return { outcome: FlushOutcome.NoBackend };

  const flush = backend.flush?.bind(backend);
  if (!flush) return { outcome: FlushOutcome.Unsupported };

  // fromPromiseFn, not fromPromise: a flush that throws synchronously would
  // otherwise escape before there is a promise to catch on.
  const result = await withTimeout(R.fromPromiseFn(flush), timeoutMs);
  if (result === TIMED_OUT) return { outcome: FlushOutcome.TimedOut };

  return R.match(result, {
    success: (): FlushResult => ({ outcome: FlushOutcome.Flushed }),
    failure: (error): FlushResult => ({ outcome: FlushOutcome.Failed, error }),
  });
}

/** Reports an exception to posthog (wired up per-platform via {@link registerAnalytics}). Never throws. */
export function captureException(
  event: ExceptionEvent,
  error: unknown,
  properties?: AnalyticsProperties,
): void {
  report(
    (b) =>
      b.captureException(error, {
        event,
        [SLACK_PROPERTY]: SEND_TO_SLACK[event],
        properties: properties ?? {},
      }),
    event,
  );
}
