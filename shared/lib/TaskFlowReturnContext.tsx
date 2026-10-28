import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type TaskFlowReturnValue = {
  /** The action whose flow closed because the member navigated away mid-task. */
  leftActionId: number | null;
  leaveTask: (actionId: number) => void;
  clearLeftTask: () => void;
};

const TaskFlowReturnContext = createContext<TaskFlowReturnValue | null>(null);

export function TaskFlowReturnProvider({ children }: { children: ReactNode }) {
  const [leftActionId, setLeftActionId] = useState<number | null>(null);
  const clearLeftTask = useCallback(() => setLeftActionId(null), []);
  const value = useMemo(
    () => ({ leftActionId, leaveTask: setLeftActionId, clearLeftTask }),
    [leftActionId, clearLeftTask],
  );
  return (
    <TaskFlowReturnContext.Provider value={value}>
      {children}
    </TaskFlowReturnContext.Provider>
  );
}

export function useTaskFlowReturn(): TaskFlowReturnValue {
  const value = useContext(TaskFlowReturnContext);
  if (!value) {
    throw new Error("useTaskFlowReturn needs a TaskFlowReturnProvider");
  }
  return value;
}
