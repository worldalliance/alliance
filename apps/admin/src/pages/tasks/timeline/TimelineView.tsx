import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import ActionTimeline from "../../../components/ActionTimeline";
import { useActionParticipants } from "../../../lib/useActionParticipants";
import { filteredOutReason, filterTasks, useTaskFilters } from "../taskFilters";

export function TimelineView() {
  const list = useActionsAdmin();
  const { unarchived, shown } = filterTasks(list.data ?? [], useTaskFilters());
  const participantsById = useActionParticipants(unarchived);
  return (
    <ActionTimeline
      actions={shown}
      latestLaunchFirst
      participantsById={participantsById}
      emptyMessage={
        filteredOutReason({
          total: list.data?.length ?? 0,
          unarchived: unarchived.length,
          shown: shown.length,
        }) ?? undefined
      }
      className="min-h-0 flex-1"
    />
  );
}
