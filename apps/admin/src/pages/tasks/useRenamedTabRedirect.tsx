import { Navigate, useLocation, useSearchParams } from "react-router";
import { TabParam } from "../../places";
import { RENAMED_TASK_TABS } from "./taskTabs";

/** A redirect to the same URL with an old tab id renamed, or `null`. */
export function useRenamedTabRedirect() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const renamed = RENAMED_TASK_TABS.get(searchParams.get(TabParam.Tab) ?? "");
  if (!renamed) return null;
  const next = new URLSearchParams(searchParams);
  next.set(TabParam.Tab, renamed);
  return (
    <Navigate
      replace
      to={{
        pathname: location.pathname,
        search: `?${next}`,
        hash: location.hash,
      }}
    />
  );
}
