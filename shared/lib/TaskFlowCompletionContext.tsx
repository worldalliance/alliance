import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type TaskFlowCompletionValue = {
  completingActionId: number | null;
  setCompletingActionId: Dispatch<SetStateAction<number | null>>;
};

const TaskFlowCompletionContext = createContext<TaskFlowCompletionValue | null>(
  null,
);

export function TaskFlowCompletionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [completingActionId, setCompletingActionId] = useState<number | null>(
    null,
  );
  const value = useMemo(
    () => ({ completingActionId, setCompletingActionId }),
    [completingActionId],
  );
  return (
    <TaskFlowCompletionContext.Provider value={value}>
      {children}
    </TaskFlowCompletionContext.Provider>
  );
}

export function useMarkTaskCompleting(params: {
  actionId: number;
  completing: boolean;
}) {
  const { actionId, completing } = params;
  const context = useContext(TaskFlowCompletionContext);
  if (!context) {
    throw new Error("useMarkTaskCompleting needs a TaskFlowCompletionProvider");
  }
  const { setCompletingActionId } = context;
  useEffect(() => {
    if (!completing) return;
    setCompletingActionId((current) => {
      if (current !== null && current !== actionId) {
        console.error(
          `Task ${actionId} marked completing while task ${current} still is`,
        );
      }
      return actionId;
    });
    return () =>
      setCompletingActionId((current) =>
        current === actionId ? null : current,
      );
  }, [setCompletingActionId, actionId, completing]);
}

/**
 * `value` as it was when this reader first saw an action marked completing,
 * until the mark clears; with `actionId`, only while that action is marked.
 * The server records the completion on submit, so a refetch in between would
 * otherwise swap the task for its completed state and unmount the flow.
 */
export function useHeldWhileTaskCompletes<T>(value: T, actionId?: number): T {
  // Outside the provider no flow can mark anything, so there's nothing to hold.
  const completingActionId =
    useContext(TaskFlowCompletionContext)?.completingActionId ?? null;
  const hold =
    completingActionId !== null &&
    (actionId === undefined || actionId === completingActionId);
  const [held, setHeld] = useState<{ value: T } | null>(null);
  if (hold && held === null) setHeld({ value });
  if (!hold && held !== null) setHeld(null);
  return hold && held ? held.value : value;
}
