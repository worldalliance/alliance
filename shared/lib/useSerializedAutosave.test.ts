import { act, cleanup, renderHook } from "@testing-library/react";
import { useMemo, useState } from "react";
import {
  useSerializedAutosave,
  type SerializedAutosaveState,
} from "./useSerializedAutosave";

type SavePlan = {
  value: number;
  basedOn: number;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type HarnessApi = SerializedAutosaveState & {
  edit: (value: number) => void;
  reset: (value: number) => void;
  draft: number;
  acknowledged: number;
};

function mountAutosave(send: (candidate: SavePlan) => Promise<void>) {
  return renderHook((): HarnessApi => {
    const [draft, setDraft] = useState(0);
    const [acknowledged, setAcknowledged] = useState(0);
    const candidate = useMemo<SavePlan | null>(
      () =>
        draft === acknowledged ? null : { value: draft, basedOn: acknowledged },
      [acknowledged, draft],
    );

    const autosave = useSerializedAutosave({
      candidate,
      save: send,
      onSaved: (saved) => setAcknowledged(saved.value),
      errorMessage: (error) =>
        error instanceof Error ? error.message : "save failed",
      debounceMs: 1,
    });

    return {
      ...autosave,
      edit: (value) => {
        autosave.clearFailure();
        setDraft(value);
      },
      reset: (value) => {
        autosave.resetAutosave();
        setDraft(value);
        setAcknowledged(value);
      },
      draft,
      acknowledged,
    };
  }).result;
}

const letAutosaveRun = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

describe("useSerializedAutosave", () => {
  afterEach(cleanup);

  it("serializes requests and re-derives the queued edit after acknowledgement", async () => {
    const requests: Array<{ plan: SavePlan; result: Deferred }> = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const send = (plan: SavePlan) => {
      const result = deferred();
      requests.push({ plan, result });
      activeRequests++;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      return result.promise.finally(() => {
        activeRequests--;
      });
    };

    const harness = mountAutosave(send);

    act(() => harness.current.edit(1));
    await letAutosaveRun();
    expect(requests.map(({ plan }) => plan)).toEqual([
      { value: 1, basedOn: 0 },
    ]);

    act(() => harness.current.edit(2));
    await letAutosaveRun();
    expect(requests).toHaveLength(1);

    await act(async () => {
      requests[0]!.result.resolve();
      await requests[0]!.result.promise;
    });
    await letAutosaveRun();

    expect(requests.map(({ plan }) => plan)).toEqual([
      { value: 1, basedOn: 0 },
      { value: 2, basedOn: 1 },
    ]);
    expect(maxActiveRequests).toBe(1);

    await act(async () => {
      requests[1]!.result.resolve();
      await requests[1]!.result.promise;
    });
    expect(harness.current.acknowledged).toBe(2);
  });

  it("coalesces every edit made while a request is in flight", async () => {
    const requests: Array<{ plan: SavePlan; result: Deferred }> = [];
    const send = (plan: SavePlan) => {
      const result = deferred();
      requests.push({ plan, result });
      return result.promise;
    };

    const harness = mountAutosave(send);

    act(() => harness.current.edit(1));
    await letAutosaveRun();

    act(() => {
      harness.current.edit(2);
      harness.current.edit(3);
      harness.current.edit(4);
    });
    await letAutosaveRun();
    expect(requests).toHaveLength(1);

    await act(async () => {
      requests[0]!.result.resolve();
      await requests[0]!.result.promise;
    });
    await letAutosaveRun();

    expect(requests[1]!.plan).toEqual({ value: 4, basedOn: 1 });

    await act(async () => {
      requests[1]!.result.resolve();
      await requests[1]!.result.promise;
    });
  });

  it("holds a failed candidate until an explicit retry", async () => {
    const requests: Deferred[] = [];
    const send = () => {
      const result = deferred();
      requests.push(result);
      return result.promise;
    };

    const harness = mountAutosave(send);

    act(() => harness.current.edit(1));
    await letAutosaveRun();
    await act(async () => {
      requests[0]!.reject(new Error("offline"));
      await requests[0]!.promise.catch(() => undefined);
    });
    await letAutosaveRun();

    expect(requests).toHaveLength(1);
    expect(harness.current.saveError).toBe("offline");

    act(() => harness.current.clearFailure());
    await letAutosaveRun();
    expect(requests).toHaveLength(2);
    expect(harness.current.saveError).toBeNull();

    await act(async () => {
      requests[1]!.resolve();
      await requests[1]!.promise;
    });
  });

  it("ignores a completion from before an authoritative reset", async () => {
    const request = deferred();
    const send = () => request.promise;

    const harness = mountAutosave(send);

    act(() => harness.current.edit(1));
    await letAutosaveRun();
    act(() => harness.current.reset(10));

    await act(async () => {
      request.resolve();
      await request.promise;
    });
    await letAutosaveRun();

    expect(harness.current.draft).toBe(10);
    expect(harness.current.acknowledged).toBe(10);
  });
});
