import {
  AnalyticsEvent,
  ExceptionEvent,
  SEND_TO_SLACK,
  SLACK_PROPERTY,
} from "@alliance/common/analytics";

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
