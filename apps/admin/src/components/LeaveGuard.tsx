import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type BlockerFunction, useBlocker } from "react-router";
import { LeaveGuardContext } from "../lib/useLeaveGuard";
import ConfirmDialog from "../ui/ConfirmDialog";

export const LEAVE_GUARD_COPY = {
  title: "Discard unsaved changes?",
  message: "Leaving now loses the changes you haven't saved.",
  stay: "Keep editing",
  leave: "Discard changes",
};

/** Where `answerLeaveGuard` answers in tests; undefined leaves it to staff. */
export const leaveGuardTestAnswer = {
  get: (): boolean | undefined => undefined,
};

/** The one navigation blocker behind every `useLeaveGuard` inside it. */
const LeaveGuard = ({ children }: { children: ReactNode }) => {
  const [guards] = useState(() => new Set<BlockerFunction>());
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      (navigation) => [...guards].some((guard) => guard(navigation)),
      [guards],
    ),
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const leave = leaveGuardTestAnswer.get();
    if (leave === undefined) return;
    if (leave) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  return (
    <LeaveGuardContext.Provider value={guards}>
      {children}
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title={LEAVE_GUARD_COPY.title}
        message={LEAVE_GUARD_COPY.message}
        cancelLabel={LEAVE_GUARD_COPY.stay}
        confirmLabel={LEAVE_GUARD_COPY.leave}
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </LeaveGuardContext.Provider>
  );
};

export default LeaveGuard;
