import { act, renderHook } from "@testing-library/react";
import {
  TaskFlowReturnProvider,
  useReopenLeftTask,
  useTaskFlowReturn,
} from "./TaskFlowReturnContext";

it("remembers the task left mid-flow until it's cleared", () => {
  const hook = renderHook(() => useTaskFlowReturn(), {
    wrapper: TaskFlowReturnProvider,
  });
  expect(hook.result.current.leftActionId).toBeNull();

  act(() => hook.result.current.leaveTask(7));
  expect(hook.result.current.leftActionId).toBe(7);

  act(() => hook.result.current.clearLeftTask());
  expect(hook.result.current.leftActionId).toBeNull();
});

it("throws outside the provider", () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  expect(() => renderHook(() => useTaskFlowReturn())).toThrow(
    "TaskFlowReturnProvider",
  );
  error.mockRestore();
});

it("reopens a left task once, on its own page, when the flow is ready", () => {
  const begin = jest.fn();
  const hook = renderHook(
    ({ actionId, onTaskPage, ready }) => {
      useReopenLeftTask({ actionId, onTaskPage, ready, begin });
      return useTaskFlowReturn();
    },
    {
      wrapper: TaskFlowReturnProvider,
      initialProps: { actionId: 7, onTaskPage: false, ready: false },
    },
  );
  act(() => hook.result.current.leaveTask(7));

  hook.rerender({ actionId: 8, onTaskPage: true, ready: true });
  hook.rerender({ actionId: 7, onTaskPage: false, ready: true });
  hook.rerender({ actionId: 7, onTaskPage: true, ready: false });
  expect(begin).not.toHaveBeenCalled();

  hook.rerender({ actionId: 7, onTaskPage: true, ready: true });
  hook.rerender({ actionId: 7, onTaskPage: true, ready: true });
  expect(begin).toHaveBeenCalledTimes(1);
  expect(hook.result.current.leftActionId).toBeNull();
});
