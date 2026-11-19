import { R } from "@alliance/common/result";
import { useEffect, useState } from "react";

const STORAGE_KEY = "alliance.admin.sidebarCollapsed.v1";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return R.unwrapOr(
    R.fromThrowable(() => window.localStorage.getItem(STORAGE_KEY) === "true"),
    false,
  );
}

function writeSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  R.fromThrowable(() =>
    window.localStorage.setItem(STORAGE_KEY, String(collapsed)),
  );
}

/** Whether the sidebar is collapsed, remembered across visits. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  useEffect(() => writeSidebarCollapsed(collapsed), [collapsed]);
  return [collapsed, setCollapsed] as const;
}
