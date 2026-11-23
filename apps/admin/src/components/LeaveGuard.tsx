import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type BlockerFunction, useBlocker } from "react-router";
import { LeaveGuardContext } from "../lib/useLeaveGuard";

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
    if (
      window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?",
      )
    ) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  return (
    <LeaveGuardContext.Provider value={guards}>
      {children}
    </LeaveGuardContext.Provider>
  );
};

export default LeaveGuard;
