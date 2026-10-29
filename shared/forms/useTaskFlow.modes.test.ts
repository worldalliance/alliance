import { act } from "@testing-library/react";
import { taskFlow } from "../lib/copy";
import { FlowStage, TaskFlowMode, taskFlowMode } from "./useTaskFlow";
import { schema, setup, setupWithPage } from "./useTaskFlow.testing";

describe("taskFlowMode", () => {
  const base = {
    submitted: false,
    disabled: false,
    preview: false,
    completable: true,
  };

  it("is live for a task the member can complete", () => {
    expect(taskFlowMode(base)).toBe(TaskFlowMode.Live);
  });

  it("previews for staff", () => {
    expect(taskFlowMode({ ...base, preview: true, completable: false })).toBe(
      TaskFlowMode.Preview,
    );
  });

  it("is read-only once submitted, when disabled, or when it can't complete", () => {
    expect(taskFlowMode({ ...base, submitted: true })).toBe(
      TaskFlowMode.ReadOnly,
    );
    expect(taskFlowMode({ ...base, disabled: true, preview: true })).toBe(
      TaskFlowMode.ReadOnly,
    );
    expect(taskFlowMode({ ...base, completable: false })).toBe(
      TaskFlowMode.ReadOnly,
    );
  });
});

describe("useTaskFlow modes", () => {
  it("shows a preview's completion card without submitting or saving", async () => {
    const { hook, saved, submits } = setup({
      mode: TaskFlowMode.Preview,
      savedScreen: 2,
      answers: { c: "z" },
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.stage).toBe(FlowStage.Background);
    await act(() => hook.result.current.start());
    await act(() => hook.result.current.next());
    await act(() => hook.result.current.next());
    expect(hook.result.current.stage).toBe(FlowStage.Complete);
    expect(hook.result.current.submittedAnswers).toEqual({ c: "z" });
    expect(submits).toHaveLength(0);
    expect(saved).toEqual([]);
  });

  it("keeps the page live while a preview shows its completion card", async () => {
    const hook = setupWithPage({
      mode: TaskFlowMode.Preview,
      answers: { a: "x", b: "y", c: "z" },
    });
    act(() => hook.result.current.flow.begin());
    await act(() => hook.result.current.flow.start());
    await act(() => hook.result.current.flow.next());
    await act(() => hook.result.current.flow.next());
    expect(hook.result.current.flow.stage).toBe(FlowStage.Complete);

    hook.rerender({ page: "after" });
    expect(hook.result.current.page).toBe("after");
  });

  it("walks a read-only task without validating, and is done on its last screen", async () => {
    const { hook, submits, exits } = setup({
      mode: TaskFlowMode.ReadOnly,
      screenValid: false,
    });
    act(() => hook.result.current.begin());
    await act(() => hook.result.current.start());
    expect(hook.result.current.nextReady).toBe(true);
    await act(() => hook.result.current.next());
    expect(hook.result.current.screenIndex).toBe(2);
    await act(() => hook.result.current.next());
    expect(exits).toHaveLength(1);
    expect(submits).toHaveLength(0);
  });

  it("is done from the background page when no question screen follows", async () => {
    const { hook, exits } = setup({
      mode: TaskFlowMode.ReadOnly,
      schema: { pages: [schema.pages[0]], outputViews: [] },
    });
    act(() => hook.result.current.begin());
    expect(hook.result.current.startLabel).toBe(taskFlow.done);
    await act(() => hook.result.current.start());
    expect(exits).toHaveLength(1);
  });
});
