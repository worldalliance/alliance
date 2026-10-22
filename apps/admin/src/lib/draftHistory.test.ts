import {
  draftHistoryReducer,
  HistoryActionKind,
  startHistory,
  type DraftHistory,
  type HistoryAction,
  type StepTag,
} from "./draftHistory";

const commit = (value: string, step: StepTag): HistoryAction<string> => ({
  kind: HistoryActionKind.Commit,
  update: () => value,
  step,
});
const run = (
  actions: HistoryAction<string>[],
  from: DraftHistory<string> = startHistory("a"),
) => actions.reduce(draftHistoryReducer<string>, from);
const undo = { kind: HistoryActionKind.Undo } as const;
const redo = { kind: HistoryActionKind.Redo } as const;

describe("draftHistoryReducer", () => {
  it("makes commits sharing a task one step", () => {
    const history = run([
      commit("b", { task: 1, run: null }),
      commit("c", { task: 1, run: null }),
      commit("d", { task: 2, run: null }),
    ]);
    expect(history.past).toEqual(["a", "c"]);
    expect(run([undo], history).present).toBe("c");
    expect(run([undo, undo], history).present).toBe("a");
  });

  it("folds a text run across tasks until focus moves", () => {
    const history = run([
      commit("b", { task: 1, run: 7 }),
      commit("bc", { task: 2, run: 7 }),
      commit("bcd", { task: 3, run: 8 }),
    ]);
    expect(history.past).toEqual(["a", "bc"]);
  });

  it("starts a new step after an undo, even in the same text run", () => {
    const history = run([
      commit("b", { task: 1, run: 7 }),
      commit("c", { task: 2, run: 7 }),
      undo,
      commit("d", { task: 3, run: 7 }),
    ]);
    expect(history.past).toEqual(["a"]);
    expect(history.present).toBe("d");
  });

  it("redoes what was undone, and drops it on a new edit", () => {
    const edited = run([
      commit("b", { task: 1, run: null }),
      commit("c", { task: 2, run: null }),
    ]);
    const undone = run([undo, undo], edited);
    expect(undone.future).toEqual(["b", "c"]);
    expect(run([redo, redo], undone).present).toBe("c");

    const branched = run([commit("x", { task: 3, run: null })], undone);
    expect(branched.future).toEqual([]);
    expect(run([redo], branched)).toBe(branched);
  });

  it("ignores undo and redo with nothing to restore", () => {
    const history = startHistory("a");
    expect(run([undo, redo], history)).toBe(history);
  });

  it("adds no step for a commit that changes nothing", () => {
    const history = startHistory("a");
    expect(
      draftHistoryReducer(history, {
        kind: HistoryActionKind.Commit,
        update: (draft) => draft,
        step: { task: 1, run: null },
      }),
    ).toBe(history);
  });

  it("adds no step for a commit equal to the present", () => {
    const history = startHistory({ value: "a" });
    expect(
      draftHistoryReducer(history, {
        kind: HistoryActionKind.Commit,
        update: (draft) => ({ ...draft }),
        step: { task: 1, run: null },
      }),
    ).toBe(history);
  });

  it("amends the present without adding a step", () => {
    const history = run([
      commit("b", { task: 1, run: null }),
      { kind: HistoryActionKind.Amend, update: (draft) => `${draft}!` },
    ]);
    expect(history.past).toEqual(["a"]);
    expect(history.present).toBe("b!");
  });

  it("starts a new step after an end, even in the same text run", () => {
    const history = run([
      commit("b", { task: 1, run: 7 }),
      { kind: HistoryActionKind.EndStep },
      commit("c", { task: 1, run: 7 }),
    ]);
    expect(history.past).toEqual(["a", "b"]);
  });

  it("maps every entry, past and future", () => {
    const history = run([
      commit("b", { task: 1, run: null }),
      commit("c", { task: 2, run: null }),
      undo,
      { kind: HistoryActionKind.MapAll, map: (draft) => draft.toUpperCase() },
    ]);
    expect(history).toMatchObject({
      past: ["A"],
      present: "B",
      future: ["C"],
    });
  });

  it("forgets every step on reset", () => {
    const history = run([
      commit("b", { task: 1, run: null }),
      undo,
      { kind: HistoryActionKind.Reset, draft: "z" },
    ]);
    expect(history).toEqual(startHistory("z"));
  });
});
