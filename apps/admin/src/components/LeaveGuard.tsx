import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type BlockerFunction, useBlocker, useNavigation } from "react-router";
import { LeaveGuardContext } from "../lib/useLeaveGuard";
import { dropPendingSearchParams } from "../lib/useSearchParam";

/** The one navigation blocker behind every `useLeaveGuard` inside it. */
const LeaveGuard = ({ children }: { children: ReactNode }) => {
  const [guards] = useState(() => new Set<BlockerFunction>());
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      (navigation) => [...guards].some((guard) => guard(navigation)),
      [guards],
    ),
  );
  // A ref, so a navigation settling while blocked doesn't ask again.
  const navigation = useNavigation();
  const inFlight = useRef(navigation.location);
  useEffect(() => {
    inFlight.current = navigation.location;
  });

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (
      window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?",
      )
    ) {
      blocker.proceed();
    } else {
      dropPendingSearchParams(inFlight.current);
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
