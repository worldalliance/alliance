import { act } from "@testing-library/react";
import { TaskFlowMode } from "./useTaskFlow";
import { header, input, setup, text } from "./useTaskFlow.testing";
import { type OutlineStep } from "./useTaskOutline";
import { SourceHistoriesStatus } from "./useVariableSourceHistories";

const headings = (outline: OutlineStep[] | null) =>
  outline?.map(({ heading }) => heading) ?? null;

describe("useTaskFlow outline", () => {
  it("lists the header of each visible page, skipping pages without one", () => {
    const { hook } = setup({
      schema: {
        pages: [
          { id: "p1", fields: [text("intro")] },
          { id: "p2", fields: [header("Pick a date"), input("a")] },
          { id: "p3", fields: [header("Hidden"), input("b")] },
          { id: "p4", fields: [header("Confirm"), input("c")] },
        ],
        outputViews: [],
      },
      visiblePageIndices: [0, 1, 3],
    });
    expect(headings(hook.result.current.outline)).toEqual([
      "Pick a date",
      "Confirm",
    ]);
  });

  it("lists a header shared by several pages once, at its first page", () => {
    const { hook } = setup({
      schema: {
        pages: [
          { id: "p1", fields: [header("Your story"), input("a")] },
          { id: "p2", fields: [header("Pick a date"), input("b")] },
          { id: "p3", fields: [header("Your story"), input("c")] },
        ],
        outputViews: [],
      },
      visiblePageIndices: [0, 1, 2],
    });
    expect(headings(hook.result.current.outline)).toEqual([
      "Your story",
      "Pick a date",
    ]);
  });

  it("trims headers and skips blank ones", () => {
    const { hook } = setup({
      schema: {
        pages: [
          { id: "p1", fields: [header(" "), input("a")] },
          { id: "p2", fields: [header("Your story"), input("b")] },
          { id: "p3", fields: [header("Your story "), input("c")] },
        ],
        outputViews: [],
      },
      visiblePageIndices: [0, 1, 2],
    });
    expect(headings(hook.result.current.outline)).toEqual(["Your story"]);
  });

  it("is pending until visibility settles", () => {
    const { hook } = setup({ visibilitySettled: false });
    expect(hook.result.current.outline).toBeNull();
  });

  it("is pending until the member's draft answers settle", () => {
    const { hook } = setup({ draftSettled: false });
    expect(hook.result.current.outline).toBeNull();
  });

  it("is empty at once for a task without headers", () => {
    const { hook } = setup({
      schema: {
        pages: [{ id: "p1", fields: [text("intro"), input("a")] }],
        outputViews: [],
      },
      visibilitySettled: false,
    });
    expect(hook.result.current.outline).toEqual([]);
  });

  it("is pending while its variables load", () => {
    const { hook } = setup({
      gate: { status: SourceHistoriesStatus.Loading },
      variablesError: "#{v}: Answers from form 9 are not loaded",
    });
    expect(hook.result.current.outline).toBeNull();
  });

  it("is empty when a variable's source form is gone", () => {
    const { hook } = setup({
      gate: { status: SourceHistoriesStatus.SourceDeleted },
    });
    expect(hook.result.current.outline).toEqual([]);
  });

  it("is empty when its variables fail to load", () => {
    const { hook } = setup({
      gate: { status: SourceHistoriesStatus.Failed, retry: () => {} },
    });
    expect(hook.result.current.outline).toEqual([]);
  });

  it("is empty when a visibility input fails", () => {
    const { hook } = setup({
      visibilitySettled: false,
      visibilityFailed: true,
    });
    expect(hook.result.current.outline).toEqual([]);
  });

  it("stays empty once a visibility input that failed loads", () => {
    const { hook, params } = setup({
      visibilitySettled: false,
      visibilityFailed: true,
    });
    params.form = {
      ...params.form,
      visibilitySettled: true,
      visibilityFailed: false,
    };
    act(() => hook.rerender());
    expect(hook.result.current.outline).toEqual([]);
  });

  it("is empty when a draft fetch fails, and stays empty once it lands", () => {
    const { hook, params } = setup({ draftSettled: false, draftFailed: true });
    expect(hook.result.current.outline).toEqual([]);

    params.form = { ...params.form, draftSettled: true, draftFailed: false };
    act(() => hook.rerender());
    expect(hook.result.current.outline).toEqual([]);
  });

  it.each([
    ["a draft fetch fails", { draftFailed: true }],
    [
      "its variables fail",
      { gate: { status: SourceHistoriesStatus.Failed, retry: () => {} } },
    ],
    [
      "a visibility input fails",
      { visibilitySettled: false, visibilityFailed: true },
    ],
    ["the draft reloads", { draftSettled: false }],
  ])("keeps its steps once listed when %s", (_, failure) => {
    const { hook, params } = setup();
    expect(headings(hook.result.current.outline)).toEqual(["h", "h2"]);

    params.form = { ...params.form, ...failure };
    act(() => hook.rerender());
    expect(headings(hook.result.current.outline)).toEqual(["h", "h2"]);
  });

  it("follows the visible pages again once a failed input recovers", () => {
    const { hook, params } = setup();
    params.form = { ...params.form, draftFailed: true };
    act(() => hook.rerender());

    params.form = {
      ...params.form,
      draftFailed: false,
      visiblePageIndices: [0, 1],
    };
    act(() => hook.rerender());
    expect(headings(hook.result.current.outline)).toEqual(["h"]);
  });

  it("is empty when its variables fail", () => {
    const { hook } = setup({ variablesError: "Unknown variable" });
    expect(hook.result.current.outline).toEqual([]);
  });

  it("lists the steps in a staff preview", () => {
    const { hook } = setup({ mode: TaskFlowMode.Preview });
    expect(headings(hook.result.current.outline)).toEqual(["h", "h2"]);
  });

  it("is empty for a read-only task", () => {
    const { hook } = setup({ mode: TaskFlowMode.ReadOnly });
    expect(hook.result.current.outline).toEqual([]);
  });
});
