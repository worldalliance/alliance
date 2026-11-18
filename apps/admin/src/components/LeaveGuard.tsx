import { type ReactNode, useEffect } from "react";
import { useBlocker } from "react-router";
import { anyGuardBlocks, LeaveGuardContext } from "../lib/useLeaveGuard";

/** The one navigation blocker behind every `useLeaveGuard` inside it. */
const LeaveGuard = ({ children }: { children: ReactNode }) => {
  const blocker = useBlocker(anyGuardBlocks);

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
    <LeaveGuardContext.Provider value={true}>
      {children}
    </LeaveGuardContext.Provider>
  );
};

export default LeaveGuard;
