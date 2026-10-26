import { type FormValue } from "@alliance/common/forms/form-schema";
import { act, renderHook } from "@testing-library/react";
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

let fetchDraft: (formId: string) => Promise<Response>;
let fetches: number;
let saves: { formId: string; answers: Record<string, unknown> }[];

serveApi(
  routes({
    "GET /tasks/formDraft/:id": ({ params }) => {
      fetches += 1;
      return fetchDraft(params.id);
    },
    "PUT /tasks/formDraft/:id": async ({ request, params }) => {
      const body = await request.json();
      saves.push({ formId: params.id, answers: body.answers });
      return Response.json(storedDraft);
    },
  }),
);

const realSetTimeout = globalThis.setTimeout;

describe("useFormDraftSync", () => {
  const draftArgs = (answers: Record<string, FormValue>, formId = 3) => ({
    enabled: true,
    formId,
    actionId: 4,
    formSnapshotId: 5,
    answers,
    publicAnswers: {},
    currentPageIndex: 0,
    edited: true,
    onSaved: () => {},
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
    // Collapses the save debounce to nothing.
    globalThis.setTimeout = ((handler: TimerHandler) =>
      realSetTimeout(handler, 0)) as typeof setTimeout;
    fetchDraft = async () => Response.json({});
    fetches = 0;
    saves = [];
  });

  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
  });

  it("holds the first save until the stored draft has been fetched", async () => {
    let landFetch: (response: Response) => void = () => {};
    fetchDraft = () =>
      new Promise<Response>((resolve) => {
        landFetch = resolve;
      });

    const { result } = renderHook(() =>
      useFormDraftSync(draftArgs({ q1: "typed on the phone" })),
    );

    await settle();
    expect(saves).toHaveLength(0);

    landFetch(Response.json({ draft: storedDraft }));
    await settle();

    expect(result.current.serverDraft?.answers).toEqual(storedDraft.answers);
    expect(saves[0]?.answers).toEqual({ q1: "typed on the phone" });
  });

  it("never saves when the fetch failed, so a stored draft survives", async () => {
    fetchDraft = async () =>
      Response.json({ message: "nope" }, { status: 500 });

    renderHook(() => useFormDraftSync(draftArgs({ q1: "typed on the phone" })));
    await settle();

    expect(fetches).toBe(1);
    expect(saves).toHaveLength(0);
  });

  it("drops a save queued while paused, and re-arms it on resume", async () => {
    const { result, rerender } = renderHook(
      (answers: Record<string, FormValue>) =>
        useFormDraftSync(draftArgs(answers)),
      { initialProps: { q1: "first" } },
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
      (formId: number) => useFormDraftSync(draftArgs({ q1: "first" }, formId)),
      { initialProps: 3 },
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
