import { R } from "@alliance/common/result";
import { useCallback, useState } from "react";

const STORAGE_KEY = "alliance.admin.sidebarCollapsed.v1";

const readCollapsed = (): boolean =>
  typeof window !== "undefined" &&
  R.unwrapOr(
    R.fromThrowable(() => window.localStorage.getItem(STORAGE_KEY) === "1"),
    false,
  );

/** Whether the sidebar is expanded, remembered per browser. */
export function useSidebarExpanded(): [boolean, () => void] {
  const [expanded, setExpanded] = useState(() => !readCollapsed());
  const toggle = useCallback(
    () =>
      setExpanded((was) => {
        R.fromThrowable(() =>
          window.localStorage.setItem(STORAGE_KEY, was ? "1" : "0"),
        );
        return !was;
      }),
    [],
  );
  return [expanded, toggle];
}
