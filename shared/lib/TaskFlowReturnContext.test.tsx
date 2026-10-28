import { act, renderHook } from "@testing-library/react";
import {
  TaskFlowReturnProvider,
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
