import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/**
 * Calls `begin` once when the member is back on the task's own page after
 * leaving its flow mid-task, as soon as the flow is `ready` to resume.
 */
export function useReopenLeftTask(params: {
  actionId: number;
  onTaskPage: boolean;
  ready: boolean;
  begin: () => void;
}) {
  const { actionId, onTaskPage, ready } = params;
  const { leftActionId, clearLeftTask } = useTaskFlowReturn();
  const beginRef = useRef(params.begin);
  beginRef.current = params.begin;
  const returning = onTaskPage && leftActionId === actionId && ready;
  useEffect(() => {
    if (!returning) return;
    clearLeftTask();
    beginRef.current();
  }, [returning, clearLeftTask]);
}
