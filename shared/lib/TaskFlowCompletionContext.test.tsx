import { renderHook } from "@testing-library/react";
import {
  TaskFlowCompletionProvider,
  useHeldWhileTaskCompletes,
  useMarkTaskCompleting,
} from "./TaskFlowCompletionContext";

function setup(heldFor?: number) {
  return renderHook(
    ({ completing, value }) => {
      useMarkTaskCompleting({ actionId: 1, completing });
      return useHeldWhileTaskCompletes(value, heldFor);
    },
    {
      wrapper: TaskFlowCompletionProvider,
      initialProps: { completing: false, value: "before" },
    },
  );
}

it("holds the value from when the action began completing until it stops", () => {
  const hook = setup(1);
  hook.rerender({ completing: true, value: "before" });
  hook.rerender({ completing: true, value: "after" });
  expect(hook.result.current).toBe("before");

  hook.rerender({ completing: false, value: "after" });
  expect(hook.result.current).toBe("after");
});

it("holds the value from the start of each completion, not the first", () => {
  const hook = setup();
  hook.rerender({ completing: true, value: "first" });
  hook.rerender({ completing: false, value: "between" });
  hook.rerender({ completing: true, value: "between" });
  hook.rerender({ completing: true, value: "after" });
  expect(hook.result.current).toBe("between");
});

it("holds for any completing action when not given one", () => {
  const hook = setup();
  hook.rerender({ completing: true, value: "before" });
  hook.rerender({ completing: true, value: "after" });
  expect(hook.result.current).toBe("before");
});

it("ignores another action completing", () => {
  const hook = setup(2);
  hook.rerender({ completing: true, value: "before" });
  hook.rerender({ completing: true, value: "after" });
  expect(hook.result.current).toBe("after");
});

it("throws when a task is marked outside the provider", () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() =>
    renderHook(() => useMarkTaskCompleting({ actionId: 1, completing: false })),
  ).toThrow("TaskFlowCompletionProvider");
  error.mockRestore();
});

it("reports a second action marked while another is completing", () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const hook = renderHook(
    ({ second }) => {
      useMarkTaskCompleting({ actionId: 1, completing: true });
      useMarkTaskCompleting({ actionId: 2, completing: second });
    },
    { wrapper: TaskFlowCompletionProvider, initialProps: { second: false } },
  );
  expect(error).not.toHaveBeenCalled();
  hook.rerender({ second: true });
  expect(error).toHaveBeenCalledWith(
    "Task 2 marked completing while task 1 still is",
  );
  error.mockRestore();
});

it("keeps a newer action's mark when the older one stops", () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const hook = renderHook(
    ({ first, value }) => {
      useMarkTaskCompleting({ actionId: 1, completing: first });
      useMarkTaskCompleting({ actionId: 2, completing: true });
      return useHeldWhileTaskCompletes(value, 2);
    },
    {
      wrapper: TaskFlowCompletionProvider,
      initialProps: { first: true, value: "before" },
    },
  );
  hook.rerender({ first: false, value: "after" });
  expect(hook.result.current).toBe("before");
  error.mockRestore();
});
