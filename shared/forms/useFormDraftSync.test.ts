import { type FormValue } from "@alliance/common/forms/form-schema";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { milliseconds } from "date-fns";
import { queryWrapper } from "../lib/testing/queryWrapper";
import { routes, serveApi } from "../lib/testing/serveApi";
import { useFormDraftSync } from "./useFormDraftSync";

const storedDraft = {
  formId: 3,
  actionId: 4,
  formSnapshotId: 5,
  answers: { q1: "typed on the laptop" },
  publicAnswers: {},
  currentPageIndex: 1,
  updatedAt: "2026-09-16T00:00:00.000Z",
};

const laterDraft = {
  ...storedDraft,
  answers: { q1: "typed on the tablet" },
  updatedAt: "2026-09-17T00:00:00.000Z",
};

let fetchDraft: (formId: string) => Promise<Response>;
let fetches: number;
let saves: { formId: string; answers: Record<string, unknown> }[];
let saveStatus: number;
let answerSave:
  | ((answers: Record<string, unknown>) => Promise<Response>)
  | undefined;

serveApi(
  routes({
    "GET /tasks/formDraft/:id": ({ params }) => {
      fetches += 1;
      return fetchDraft(params.id);
    },
    "PUT /tasks/formDraft/:id": async ({ request, params }) => {
      const body = await request.json();
      saves.push({ formId: params.id, answers: body.answers });
      if (answerSave) return answerSave(body.answers);
      return saveStatus === 200
        ? Response.json(storedDraft)
        : Response.json({ message: "nope" }, { status: saveStatus });
    },
  }),
);

const realSetTimeout = globalThis.setTimeout;

// Mobile's cache defaults, so the tests see the hook's own options.
const cachingWrapper = () =>
  queryWrapper({
    staleTime: milliseconds({ minutes: 5 }),
    gcTime: milliseconds({ minutes: 30 }),
  });

const noPublicAnswers = {};
const ignoreSaved = () => {};
const typedOnPhone = { q1: "typed on the phone" };
const typedFirst = { q1: "first" };

describe("useFormDraftSync", () => {
  // The renderers pass state, which keeps its identity across renders; fresh
  // objects on every render would re-arm the save after each one.
  const draftArgs = (answers: Record<string, FormValue>, formId = 3) => ({
    enabled: true,
    formId,
    actionId: 4,
    formSnapshotId: 5,
    answers,
    publicAnswers: noPublicAnswers,
    currentPageIndex: 0,
    edited: true,
    onSaved: ignoreSaved,
  });

  /** Runs whatever the debounce has queued, and the request behind it. One
   * `act` per tick, so an effect armed by the last tick gets to run. */
  const settle = async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      await act(async () => {
        await new Promise((resolve) => realSetTimeout(resolve, 0));
      });
    }
  };

  beforeEach(() => {
    // Collapses the save debounce to nothing, leaving the cache's
    // minutes-long eviction timers alone.
    globalThis.setTimeout = ((handler: TimerHandler, delay?: number) =>
      realSetTimeout(
        handler,
        delay !== undefined && delay >= milliseconds({ minutes: 1 })
          ? delay
          : 0,
      )) as typeof setTimeout;
    fetchDraft = async () => Response.json({});
    fetches = 0;
    saves = [];
    saveStatus = 200;
    answerSave = undefined;
  });

  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
    onlineManager.setOnline(true);
  });

  it("holds the first save until the stored draft has been fetched", async () => {
    let landFetch: (response: Response) => void = () => {};
    fetchDraft = () =>
      new Promise<Response>((resolve) => {
        landFetch = resolve;
      });

    const { result } = renderHook(
      () => useFormDraftSync(draftArgs(typedOnPhone)),
      cachingWrapper(),
    );

    await settle();
    expect(saves).toHaveLength(0);

    landFetch(Response.json({ draft: storedDraft }));
    await settle();

    expect(result.current.serverDraft?.answers).toEqual(storedDraft.answers);
    expect(saves[0]?.answers).toEqual(typedOnPhone);
  });

  it("never saves when the fetch failed, so a stored draft survives", async () => {
    fetchDraft = async () =>
      Response.json({ message: "nope" }, { status: 500 });

    renderHook(
      () => useFormDraftSync(draftArgs(typedOnPhone)),
      cachingWrapper(),
    );
    await settle();

    expect(fetches).toBe(1);
    expect(saves).toHaveLength(0);
  });

  it("records each landed save's updatedAt, even one a later save overtook", async () => {
    const held: ((response: Response) => void)[] = [];
    answerSave = () =>
      new Promise<Response>((resolve) => {
        held.push(resolve);
      });
    const saved: string[] = [];
    const recordSaved = (updatedAt: string) => saved.push(updatedAt);
    const { rerender } = renderHook(
      (answers: Record<string, FormValue>) =>
        useFormDraftSync({ ...draftArgs(answers), onSaved: recordSaved }),
      { initialProps: typedFirst, ...cachingWrapper() },
    );
    await settle();
    rerender({ q1: "second" });
    await settle();
    expect(held).toHaveLength(2);

    held[0](Response.json({ ...storedDraft, updatedAt: "first" }));
    await settle();
    held[1](Response.json({ message: "nope" }, { status: 500 }));
    await settle();

    expect(saved).toEqual(["first"]);
  });

  it("reports a failed save until a later one lands", async () => {
    saveStatus = 500;
    const { result, rerender } = renderHook(
      (answers: Record<string, FormValue>) =>
        useFormDraftSync(draftArgs(answers)),
      { initialProps: typedFirst, ...cachingWrapper() },
    );
    await settle();
    expect(result.current.saveFailed).toBe(true);

    saveStatus = 200;
    rerender({ q1: "second" });
    await settle();

    expect(result.current.saveFailed).toBe(false);
  });

  it("fails a save made offline rather than queueing it", async () => {
    const { result, rerender } = renderHook(
      (answers: Record<string, FormValue>) =>
        useFormDraftSync(draftArgs(answers)),
      { initialProps: typedFirst, ...cachingWrapper() },
    );
    await settle();
    expect(saves).toHaveLength(1);

    onlineManager.setOnline(false);
    saveStatus = 503;
    rerender({ q1: "second" });
    await settle();
    expect(result.current.saveFailed).toBe(true);

    saveStatus = 200;
    onlineManager.setOnline(true);
    await settle();

    expect(saves).toHaveLength(2);
  });

  it("opens the save path once a retried fetch succeeds", async () => {
    let failNext = true;
    fetchDraft = async () => {
      if (!failNext) return Response.json({});
      failNext = false;
      return Response.json({ message: "nope" }, { status: 500 });
    };

    renderHook(() => useFormDraftSync(draftArgs(typedOnPhone)), {
      wrapper: queryWrapper({ retry: 1 }).wrapper,
    });
    await settle();

    expect(fetches).toBe(2);
    expect(saves[0]?.answers).toEqual(typedOnPhone);
  });

  it("reads the stored draft afresh on remount instead of a cached copy", async () => {
    fetchDraft = async () => Response.json({ draft: storedDraft });
    const query = cachingWrapper();
    const first = renderHook(
      () => useFormDraftSync(draftArgs(typedOnPhone)),
      query,
    );
    await settle();
    first.unmount();
    await settle();

    let landFetch: (response: Response) => void = () => {};
    fetchDraft = () =>
      new Promise<Response>((resolve) => {
        landFetch = resolve;
      });
    const { result } = renderHook(
      () => useFormDraftSync(draftArgs(typedOnPhone)),
      query,
    );
    await settle();
    expect(saves).toHaveLength(1);
    expect(result.current.serverDraft).toBeNull();

    landFetch(Response.json({ draft: laterDraft }));
    await settle();

    expect(fetches).toBe(2);
    expect(result.current.serverDraft).toEqual(laterDraft);
    expect(saves).toHaveLength(2);
  });

  it("holds a remount read paused offline, then reads once back online", async () => {
    fetchDraft = async () => Response.json({ draft: storedDraft });
    const query = cachingWrapper();
    const first = renderHook(
      () => useFormDraftSync(draftArgs(typedOnPhone)),
      query,
    );
    await settle();
    first.unmount();
    await settle();

    onlineManager.setOnline(false);
    fetchDraft = async () => Response.json({ draft: laterDraft });
    const { result } = renderHook(
      () => useFormDraftSync(draftArgs(typedOnPhone)),
      query,
    );
    await settle();
    expect(fetches).toBe(1);
    expect(saves).toHaveLength(1);
    expect(result.current.serverDraft).toBeNull();

    onlineManager.setOnline(true);
    await settle();

    expect(fetches).toBe(2);
    expect(result.current.serverDraft).toEqual(laterDraft);
    expect(saves).toHaveLength(2);
  });

  it("reads the stored draft again before saving once re-enabled", async () => {
    fetchDraft = async () => Response.json({ draft: storedDraft });
    const { result, rerender } = renderHook(
      (enabled: boolean) =>
        useFormDraftSync({ ...draftArgs(typedOnPhone), enabled }),
      { initialProps: true, ...cachingWrapper() },
    );
    await settle();
    rerender(false);
    await settle();
    expect(saves).toHaveLength(1);

    let landFetch: (response: Response) => void = () => {};
    fetchDraft = () =>
      new Promise<Response>((resolve) => {
        landFetch = resolve;
      });
    rerender(true);
    await settle();
    expect(saves).toHaveLength(1);
    expect(result.current.serverDraft).toBeNull();

    landFetch(Response.json({ draft: laterDraft }));
    await settle();

    expect(fetches).toBe(2);
    expect(result.current.serverDraft).toEqual(laterDraft);
    expect(saves).toHaveLength(2);
  });

  it("drops a save queued while paused, and re-arms it on resume", async () => {
    const { result, rerender } = renderHook(
      (answers: Record<string, FormValue>) =>
        useFormDraftSync(draftArgs(answers)),
      { initialProps: typedFirst, ...cachingWrapper() },
    );

    await settle();
    expect(saves).toHaveLength(1);

    act(() => result.current.pauseSyncing());
    rerender({ q1: "second" });
    await settle();
    expect(saves).toHaveLength(1);

    act(() => result.current.resumeSyncing());
    await settle();

    expect(saves).toHaveLength(2);
    expect(saves[1].answers).toEqual({ q1: "second" });
  });

  it("gates again on the new form when the form changes under it", async () => {
    let landSecond: (response: Response) => void = () => {};
    fetchDraft = (formId) =>
      formId === "3"
        ? Promise.resolve(Response.json({}))
        : new Promise<Response>((resolve) => {
            landSecond = resolve;
          });

    const { rerender } = renderHook(
      (formId: number) => useFormDraftSync(draftArgs(typedFirst, formId)),
      { initialProps: 3, ...cachingWrapper() },
    );

    await settle();
    expect(saves).toHaveLength(1);

    rerender(7);
    await settle();
    expect(saves).toHaveLength(1);

    landSecond(Response.json({}));
    await settle();

    expect(saves[1]?.formId).toBe("7");
  });
});
