// Debounced, single-flight saving of the whole export.
//
// - changed() restarts a debounce timer; when it fires, the current export is built and saved.
// - Never more than one save in flight. Changes that arrive during a save are saved once it settles.
// - A rejected save keeps everything (the export is rebuilt from live state next time), reports Failed, and is
//   retried on the next change or on flush(). The next success after a failure reports Saved.

export type SaveOutcome = "saved" | "failed";

export interface SaverOptions<T> {
  build: () => T;
  save: (value: T) => Promise<void>;
  onFailed: () => void;
  onRecovered: () => void;
  delayMs?: number;
}

export interface Saver {
  /** Something changed: save about delayMs after the last change. */
  changed(): void;
  /** Save now if anything is unsaved (waiting for any save in flight first). Rejects if that save fails. */
  flush(): Promise<void>;
  /** Stop: cancel the pending timer and ignore further changes. A save already in flight still settles. */
  dispose(): void;
  readonly dirty: boolean;
}

export function createSaver<T>(o: SaverOptions<T>): Saver {
  const delay = o.delayMs ?? 2000;
  let dirty = false;
  let failed = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<SaveOutcome> | null = null;
  let changedDuringFlight = false;
  let lastError: unknown = null;

  const clearTimer = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };

  function run(): Promise<SaveOutcome> {
    if (inflight) return inflight;
    dirty = false;
    changedDuringFlight = false;
    let value: T;
    try { value = o.build(); }
    catch (e) { dirty = true; return Promise.reject(e); }
    const p = (async (): Promise<SaveOutcome> => {
      try {
        await o.save(value);
        lastError = null;
        if (failed) { failed = false; if (!disposed) o.onRecovered(); }
        return "saved";
      } catch (e) {
        lastError = e;
        dirty = true;
        failed = true;
        if (!disposed) o.onFailed();
        return "failed";
      }
    })();
    inflight = p;
    p.then(outcome => {
      inflight = null;
      if (disposed) return;
      // Changes arrived mid-save and their debounce has already fired: save them now.
      // After a failure, only a change made during the failed save triggers the retry.
      if (dirty && timer === null && (outcome === "saved" || changedDuringFlight)) void run();
    });
    return p;
  }

  return {
    changed() {
      if (disposed) return;
      dirty = true;
      if (inflight) changedDuringFlight = true;
      clearTimer();
      timer = setTimeout(() => { timer = null; if (!inflight) void run(); }, delay);
    },
    async flush() {
      clearTimer();
      // A settling save may start a follow-up save for changes made meanwhile, so wait until none is in flight.
      while (inflight) await inflight;
      if (!dirty) {
        if (failed) throw lastError ?? new Error("The last save failed.");
        return;
      }
      const outcome = await run();
      if (outcome === "failed") throw lastError ?? new Error("Save failed.");
    },
    dispose() { disposed = true; clearTimer(); },
    get dirty() { return dirty; },
  };
}
