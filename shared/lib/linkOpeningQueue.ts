import { ExceptionEvent } from "@alliance/common/analytics";
import {
  LINK_OPENING_DEADLINE_MS,
  LinkOpeningPlatform,
  type TrackedArrival,
} from "@alliance/common/linkOpening";
import { R } from "@alliance/common/result";
import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import { z } from "zod";
import { linkOpeningRecord } from "../client";
import { captureException } from "./analytics";
import { isRefusedStatus } from "./retryQuery";

const queuedOpeningSchema = z.object({
  openingId: z.string(),
  trackingId: z.string(),
  destination: z.string(),
  platform: z.enum(LinkOpeningPlatform),
  observedAt: z.iso.datetime(),
});
export type QueuedOpening = z.infer<typeof queuedOpeningSchema>;

export type OpeningStorage = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
};

export enum SendResult {
  /** Recorded, already recorded, or refused for good. */
  Settled = "settled",
  Retry = "retry",
}

const SEND_TIMEOUT_MS = 30_000;
const FIRST_RETRY_MS = 2_000;
const MAX_RETRY_MS = 5 * 60_000;

export async function sendOpening(
  opening: QueuedOpening,
  timeoutMs = SEND_TIMEOUT_MS,
): Promise<SendResult> {
  const sent = await withTimeout(
    // keepalive lets a send in flight outlive the page navigating away.
    R.fromPromise(
      linkOpeningRecord({
        body: opening,
        throwOnError: false,
        keepalive: true,
      }),
    ),
    timeoutMs,
  );
  if (sent === TIMED_OUT) return SendResult.Retry;
  const status = sent.ok ? sent.value.response?.status : undefined;
  if (sent.ok && sent.value.response?.ok) return SendResult.Settled;
  if (!isRefusedStatus(status)) return SendResult.Retry;
  // A 404 is an unknown or deleted recipient's link; any other refusal is a
  // bug, or a device clock off by more than the server allows.
  if (status !== 404 && sent.ok) {
    captureException(ExceptionEvent.LinkOpeningRefused, sent.value.error, {
      status,
    });
  }
  return SendResult.Settled;
}

/** For Hermes, which has no `crypto.randomUUID`; the ID only has to be unique. */
export const pseudoRandomUuid = (): string =>
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (digit) =>
    (
      Number(digit) ^
      (Math.floor(Math.random() * 256) & (15 >> (Number(digit) / 4)))
    ).toString(16),
  );

const randomUuid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? pseudoRandomUuid();

/**
 * Records link openings until the server acknowledges them, through restarts,
 * for {@link LINK_OPENING_DEADLINE_MS} after each was observed. When storage
 * fails, an opening is kept in memory and retried only while the app runs.
 * Nothing is sent before `start`, which the app calls once the API client is
 * configured.
 */
export function createLinkOpeningQueue(params: {
  storage: OpeningStorage;
  platform: LinkOpeningPlatform;
  send?: (opening: QueuedOpening) => Promise<SendResult>;
  /** After a pass that settled at least one opening. */
  onSettled?: () => void;
  now?: () => Date;
  schedule?: (run: () => void, delayMs: number) => void;
}) {
  const {
    storage,
    platform,
    send = sendOpening,
    onSettled,
    now = () => new Date(),
    schedule = (run, delayMs) => void setTimeout(run, delayMs),
  } = params;
  let started = false;
  let unstored: QueuedOpening[] = [];
  let flushing: Promise<void> | null = null;
  let rerun = false;
  let storageTurn: Promise<unknown> = Promise.resolve();
  let retryDelay = FIRST_RETRY_MS;
  let retryScheduled = false;
  let readFailureReported = false;
  const expiryReported = new Set<string>();

  const live = (opening: QueuedOpening): boolean =>
    now().getTime() - Date.parse(opening.observedAt) < LINK_OPENING_DEADLINE_MS;

  const readStored = async (): Promise<{
    openings: QueuedOpening[];
    unreadable: boolean;
  }> => {
    const raw = await storage.read();
    if (raw === null) return { openings: [], unreadable: false };
    const entries = z.array(z.unknown()).safeParse(
      R.unwrapOr(
        R.fromThrowable(() => JSON.parse(raw)),
        null,
      ),
    );
    const parsed = (entries.success ? entries.data : []).map((entry) =>
      queuedOpeningSchema.safeParse(entry),
    );
    const openings = parsed.flatMap((entry) =>
      entry.success ? [entry.data] : [],
    );
    return {
      openings,
      unreadable: !entries.success || openings.length < parsed.length,
    };
  };

  // Updates run one at a time and reread storage, so none drops another's
  // opening. Another tab's write can still interleave with one.
  const updateStored = (
    update: (stored: QueuedOpening[]) => QueuedOpening[],
  ): Promise<boolean> => {
    const updating = storageTurn.then(async () => {
      const updated = await R.fromPromiseFn(async () => {
        const { openings, unreadable } = await readStored();
        if (unreadable) {
          captureException(
            ExceptionEvent.LinkOpeningsUnreadable,
            new Error("dropped unreadable stored link openings"),
          );
        }
        await storage.write(JSON.stringify(update(openings)));
      });
      if (R.isFailure(updated)) {
        captureException(ExceptionEvent.LinkOpeningNotStored, updated.error);
      }
      return updated.ok;
    });
    storageTurn = updating;
    return updating;
  };

  const scheduleRetry = (): void => {
    if (retryScheduled) return;
    retryScheduled = true;
    schedule(() => {
      retryScheduled = false;
      void flush();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
  };

  const flushOnce = async (): Promise<void> => {
    const stored = await R.fromPromiseFn(readStored);
    if (R.isFailure(stored) && !readFailureReported) {
      readFailureReported = true;
      captureException(ExceptionEvent.LinkOpeningsUnreadable, stored.error);
    }
    const waiting = [...(stored.ok ? stored.value.openings : []), ...unstored];
    // Decided once, so an opening that expires mid-pass is reported by the
    // retry rather than dropped silently.
    const expired = new Set(
      waiting
        .filter((opening) => !live(opening))
        .map(({ openingId }) => openingId),
    );
    for (const opening of waiting.filter(
      ({ openingId }) =>
        expired.has(openingId) && !expiryReported.has(openingId),
    )) {
      expiryReported.add(opening.openingId);
      captureException(
        ExceptionEvent.LinkOpeningExpired,
        new Error("link opening expired unsent"),
        { observedAt: opening.observedAt },
      );
    }
    const pending = waiting.filter(({ openingId }) => !expired.has(openingId));
    const settled = new Set<string>();
    // Stored openings it couldn't read get another pass.
    let retrying = R.isFailure(stored);
    for (const opening of pending) {
      const result = await send(opening);
      switch (result) {
        case SendResult.Settled:
          settled.add(opening.openingId);
          break;
        case SendResult.Retry:
          retrying = true;
          break;
        default:
          throw new Error(`unknown send result: ${result satisfies never}`);
      }
    }
    const kept = ({ openingId }: QueuedOpening) =>
      !settled.has(openingId) && !expired.has(openingId);
    unstored = unstored.filter(kept);
    if (
      stored.ok &&
      (settled.size || expired.size || stored.value.unreadable)
    ) {
      await updateStored((current) => current.filter(kept));
    }
    if (settled.size) onSettled?.();
    if (retrying) {
      scheduleRetry();
    } else {
      retryDelay = FIRST_RETRY_MS;
    }
  };

  /** Sends whatever is waiting; concurrent calls share one pass. */
  const flush = (): Promise<void> => {
    if (!started) return Promise.resolve();
    flushing ??= (async () => {
      do {
        rerun = false;
        await flushOnce();
      } while (rerun);
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  };

  /** Resolves once the opening is stored, or held in memory, before it is sent. */
  const record = async (arrival: TrackedArrival): Promise<void> => {
    const opening: QueuedOpening = {
      openingId: randomUuid(),
      trackingId: arrival.trackingId,
      destination: arrival.destination,
      platform,
      observedAt: now().toISOString(),
    };
    if (!(await updateStored((stored) => [...stored, opening]))) {
      unstored.push(opening);
    }
    // A pass in flight may have read storage before this opening.
    rerun = true;
    void flush();
  };

  const start = (): Promise<void> => {
    started = true;
    return flush();
  };

  return { record, flush, start };
}

export type LinkOpeningQueue = ReturnType<typeof createLinkOpeningQueue>;
