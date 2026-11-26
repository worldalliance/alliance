import { useParams } from "react-router";
import { RecordId } from "../../places";
import { TaskRecord } from "./TaskRecord";
import { useRenamedTabRedirect } from "./useRenamedTabRedirect";

const NEW = "new";

/** `/tasks/:actionId` and `/tasks/new`. */
export default function TaskPage() {
  const { actionId } = useParams();
  const redirect = useRenamedTabRedirect();
  if (redirect) return redirect;
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
