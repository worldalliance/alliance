import {
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router";
import { RecordId, TabParam } from "../../places";
import { TaskRecord } from "./TaskRecord";
import { RENAMED_TASK_TABS } from "./taskTabs";

const NEW = "new";

/** `/tasks/:actionId` and `/tasks/new`. */
export default function TaskPage() {
  const { actionId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const renamed = RENAMED_TASK_TABS.get(searchParams.get(TabParam.Tab) ?? "");
  if (renamed) {
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
  return (
    <TaskRecord
      route={
        actionId === NEW
          ? { kind: "new" }
          : { kind: "task", actionId: parseTaskId(actionId) }
      }
      record={RecordId.Task}
    />
  );
}

/** `null` for an id that can't exist, so it is not found with no request. */
export const parseTaskId = (param: string | undefined): number | null =>
  param !== undefined && /^[1-9]\d*$/.test(param) ? Number(param) : null;
