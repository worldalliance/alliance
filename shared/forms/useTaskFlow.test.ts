import { act } from "@testing-library/react";
import { taskFlow } from "../lib/copy";
import { type SubmitOutcome } from "./submitOutcome";
import { FlowStage } from "./useTaskFlow";
import {
  header,
  input,
  schema,
  setup,
  setupWithPage,
  text,
} from "./useTaskFlow.testing";

describe("useTaskFlow", () => {
  it("begins on the background page when nothing is saved", () => {
    const { hook } = setup();
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Background);
    expect(hook.result.current.background).toEqual([text("intro")]);
    expect(hook.result.current.progress).toBeCloseTo(100 / 3);
  });

  it("resumes on the saved screen", () => {
    const { hook } = setup({ savedScreen: 2 });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(2);
    expect(hook.result.current.nextLabel).toBe(taskFlow.submit);
  });

  it("shows opening content whose questions are hidden as the background page", () => {
    const { hook, params } = setup({
      schema: {
        pages: [
          { id: "p1", fields: [text("intro"), input("hidden")] },
          { id: "p2", fields: [header("h"), input("a")] },
        ],
        outputViews: [],
      },
    });
    params.form = {
      ...params.form,
      isElementCurrentlyVisible: (element) => element.id !== "hidden",
    };
    hook.rerender();
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Background);
    expect(hook.result.current.background).toEqual([
      text("intro"),
      input("hidden"),
    ]);
  });

  it("goes back from the first question screen to the background page", async () => {
    const { hook, saved } = setup();
    act(() => hook.result.current.begin());
    await act(() => hook.result.current.start());
    expect(hook.result.current.screenIndex).toBe(1);
    act(() => hook.result.current.back());
    expect(hook.result.current.stage).toBe(FlowStage.Background);
    expect(saved).toEqual([0, 1, 0]);
  });

  it("exits on Back from the first screen of a form with no background", () => {
    const { hook, exits } = setup({
      schema: { pages: [schema.pages[1]], outputViews: [] },
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    act(() => hook.result.current.back());
    expect(exits).toHaveLength(1);
  });

  it("is ready for Next only once the screen's inputs pass", () => {
    const empty = setup({ savedScreen: 1 });
    act(() => empty.hook.result.current.begin());
    expect(empty.hook.result.current.nextReady).toBe(false);

    const filled = setup({ savedScreen: 1, answers: { a: "x", b: "y" } });
    act(() => filled.hook.result.current.begin());
    expect(filled.hook.result.current.nextReady).toBe(true);
  });

  it("stays on a screen that fails validation", async () => {
    const { hook } = setup({ savedScreen: 1, screenValid: false });
    act(() => hook.result.current.begin());
    await act(() => hook.result.current.next());
    expect(hook.result.current.screenIndex).toBe(1);
  });

  it("stays on a last screen that fails validation, without submitting", async () => {
    const { hook, cleared } = setup({ savedScreen: 2, screenValid: false });
    act(() => hook.result.current.begin());
    await act(() => hook.result.current.next());
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(2);
    expect(cleared).toHaveLength(0);
  });

  it("stays closed when the flow closes while a screen validates", async () => {
    const validation = Promise.withResolvers<boolean>();
    const { hook } = setup({ savedScreen: 1, screenValid: validation.promise });
    act(() => hook.result.current.begin());
    let next = Promise.resolve();
    act(() => {
      next = hook.result.current.next();
    });
    act(() => hook.result.current.close());
    await act(async () => {
      validation.resolve(true);
      await next;
    });
    expect(hook.result.current.stage).toBe(FlowStage.Closed);
    expect(hook.result.current.screenIndex).toBe(1);
  });

  it("stays where Back went while the screen it left validates", async () => {
    const validation = Promise.withResolvers<boolean>();
    const { hook } = setup({ savedScreen: 1, screenValid: validation.promise });
    act(() => hook.result.current.begin());
    let next = Promise.resolve();
    act(() => {
      next = hook.result.current.next();
    });
    act(() => hook.result.current.back());
    await act(async () => {
      validation.resolve(true);
      await next;
    });
    expect(hook.result.current.stage).toBe(FlowStage.Background);
  });

  it("submits from the background page when no question screen shows", async () => {
    const { hook } = setup({
      schema: { pages: [schema.pages[0]], outputViews: [] },
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Background);
    await act(async () => hook.result.current.start());
    expect(hook.result.current.stage).toBe(FlowStage.Complete);
  });

  it("jumps to the first screen of the page a failed submit names", async () => {
    const { hook } = setup({
      savedScreen: 2,
      outcome: { submitted: false, firstInvalidPageIndex: 1 },
    });
    act(() => hook.result.current.begin());
    await act(() => hook.result.current.next());
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(1);
  });

  it("completes with the submitted answers and forgets the position", async () => {
    const { hook, cleared } = setup({ savedScreen: 2, answers: { c: "z" } });
    act(() => hook.result.current.begin());
    await act(() => hook.result.current.next());
    expect(hook.result.current.stage).toBe(FlowStage.Complete);
    expect(hook.result.current.submittedAnswers).toEqual({ c: "z" });
    expect(cleared).toHaveLength(1);
  });

  it("opens the background page, not a submit, when the draft's page is now hidden", () => {
    const { hook, submits } = setup({
      visiblePageIndices: [0],
      currentPageIndex: 1,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Background);
    expect(submits).toHaveLength(0);
  });

  it("stays closed and submits nothing when no screen is visible", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { hook, submits } = setup({ visiblePageIndices: [] });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Closed);
    expect(submits).toHaveLength(0);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("submits once when Next is pressed twice on the last screen", async () => {
    const { hook, submits } = setup({ savedScreen: 2, answers: { c: "z" } });
    act(() => hook.result.current.begin());
    await act(() =>
      Promise.all([hook.result.current.next(), hook.result.current.next()]),
    );
    expect(submits).toHaveLength(1);
  });

  it("submits once when a background-only form's Next is pressed twice", async () => {
    const { hook, submits } = setup({
      schema: { pages: [schema.pages[0]], outputViews: [] },
    });
    act(() => hook.result.current.begin());
    await act(() =>
      Promise.all([hook.result.current.start(), hook.result.current.start()]),
    );
    expect(submits).toHaveLength(1);
  });

  it("labels the background page's button Submit only when no question screen follows", () => {
    const backgroundOnly = setup({
      schema: { pages: [schema.pages[0]], outputViews: [] },
    });
    expect(backgroundOnly.hook.result.current.startLabel).toBe(taskFlow.submit);
    expect(setup().hook.result.current.startLabel).toBe(taskFlow.next);
  });

  it("holds Next while visibility is still settling", async () => {
    const { hook } = setup({
      savedScreen: 1,
      answers: { a: "x", b: "y" },
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.nextReady).toBe(false);
    await act(() => hook.result.current.next());
    expect(hook.result.current.screenIndex).toBe(1);
  });

  it("holds the background page's Next while visibility is still settling", async () => {
    const { hook, submits } = setup({
      savedScreen: 0,
      visiblePageIndices: [0],
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    await act(() => hook.result.current.start());
    expect(submits).toHaveLength(0);
    expect(hook.result.current.stage).toBe(FlowStage.Background);
  });

  it("resumes the saved screen before visibility settles, without saving over it", () => {
    const { hook, saved } = setup({
      savedScreen: 2,
      visiblePageIndices: [0],
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(2);
    expect(saved).toEqual([2]);
  });

  it("moves off a resumed screen that settling visibility hides", () => {
    const { hook, params, saved } = setup({
      savedScreen: 2,
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.screenIndex).toBe(2);

    params.form = {
      ...params.form,
      visibilitySettled: true,
      isElementCurrentlyVisible: (element) => element.id !== "c",
    };
    hook.rerender();
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(1);
    expect(saved).toEqual([2, 1]);
  });

  it("returns to the background page when settling hides every question screen", () => {
    const { hook, params } = setup({
      savedScreen: 2,
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());

    params.form = {
      ...params.form,
      visibilitySettled: true,
      visiblePageIndices: [0],
    };
    hook.rerender();
    expect(hook.result.current.stage).toBe(FlowStage.Background);
  });

  it("leaves the background page when settling hides it", () => {
    const { hook, params } = setup({
      savedScreen: 0,
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Background);

    params.form = {
      ...params.form,
      visibilitySettled: true,
      visiblePageIndices: [1],
    };
    hook.rerender();
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(1);
  });

  it("shows a resumed screen that settling makes the background as the background page", () => {
    const { hook, params, saved } = setup({
      savedScreen: 0,
      visiblePageIndices: [],
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Screens);

    params.form = {
      ...params.form,
      visibilitySettled: true,
      visiblePageIndices: [0, 1],
    };
    hook.rerender();
    expect(hook.result.current.stage).toBe(FlowStage.Background);
    expect(saved).toEqual([0, 0]);
  });

  it("ignores a saved screen the form no longer has", () => {
    const { hook, params } = setup({
      savedScreen: 7,
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Closed);

    params.form = { ...params.form, visibilitySettled: true };
    hook.rerender();
    expect(hook.result.current.stage).toBe(FlowStage.Background);
  });

  it("keeps the draft's page when it shows only once visibility settles", () => {
    const { hook, params, saved } = setup({
      schema: {
        pages: [
          { id: "p1", fields: [text("intro")] },
          { id: "p2", fields: [header("h"), input("a")] },
          { id: "p3", fields: [header("h3"), input("z")] },
        ],
        outputViews: [],
      },
      currentPageIndex: 2,
      visiblePageIndices: [0, 1],
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Closed);

    params.form = {
      ...params.form,
      visibilitySettled: true,
      visiblePageIndices: [0, 1, 2],
    };
    hook.rerender();
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(2);
    expect(saved).toEqual([2]);
  });

  it("opens once visibility settles when nothing shows before then", () => {
    const { hook, params } = setup({
      visiblePageIndices: [],
      visibilitySettled: false,
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Closed);

    params.form = {
      ...params.form,
      visibilitySettled: true,
      visiblePageIndices: [0, 1],
    };
    hook.rerender();
    expect(hook.result.current.stage).toBe(FlowStage.Background);
  });

  it("resumes the draft's question screen when the draft is past the background", () => {
    const { hook } = setup({ currentPageIndex: 1 });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Screens);
    expect(hook.result.current.screenIndex).toBe(1);
  });

  it("opens nothing before the saved screen has loaded", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const { hook } = setup({ positionLoaded: false });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Closed);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("holds the task's pages from submitting until the completion screen closes", async () => {
    const hook = setupWithPage({ savedScreen: 2, answers: { c: "z" } });
    act(() => hook.result.current.flow.begin());
    await act(() => hook.result.current.flow.next());
    expect(hook.result.current.flow.stage).toBe(FlowStage.Complete);

    hook.rerender({ page: "after" });
    expect(hook.result.current.page).toBe("before");

    act(() => hook.result.current.flow.close());
    expect(hook.result.current.page).toBe("after");
  });

  it("holds the task's pages while the submit is in flight", async () => {
    let settle: (outcome: SubmitOutcome) => void = () => {};
    const hook = setupWithPage({
      savedScreen: 2,
      answers: { c: "z" },
      submit: () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    });
    act(() => hook.result.current.flow.begin());
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = hook.result.current.flow.next();
    });

    hook.rerender({ page: "after" });
    expect(hook.result.current.page).toBe("before");

    await act(async () => {
      settle({ submitted: true, firstInvalidPageIndex: null });
      await pending;
    });
    expect(hook.result.current.flow.stage).toBe(FlowStage.Complete);
  });

  it("lets the pages update again when a submit fails", async () => {
    const hook = setupWithPage({
      savedScreen: 2,
      outcome: { submitted: false, firstInvalidPageIndex: 1 },
    });
    act(() => hook.result.current.flow.begin());
    await act(() => hook.result.current.flow.next());

    hook.rerender({ page: "after" });
    expect(hook.result.current.page).toBe("after");
  });

  it("lets the pages update again when the submit throws", async () => {
    const hook = setupWithPage({
      savedScreen: 2,
      answers: { c: "z" },
      submit: () => Promise.reject(new Error("offline")),
    });
    act(() => hook.result.current.flow.begin());
    await act(() => hook.result.current.flow.next().catch(() => {}));

    hook.rerender({ page: "after" });
    expect(hook.result.current.page).toBe("after");
  });
});
