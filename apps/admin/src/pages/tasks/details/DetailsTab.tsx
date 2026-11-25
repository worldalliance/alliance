import { useState } from "react";
import { useNavigate } from "react-router";
import { placeById, PlaceId, RecordId, tabHref } from "../../../places";
import ActionEditor from "../../action-dashboard/ActionEditor";
import ActionReadinessChecklist from "../../action-dashboard/ActionReadinessChecklist";
import { useActionReporting } from "../../action-dashboard/useActionReporting";
import type { NewTaskProps, TaskTabProps } from "../taskTabs";

export function DetailsTab({
  task,
  record,
  admin,
  editor,
  lookups,
}: TaskTabProps) {
  const { taskForm } = useActionReporting(task, task.id);
  const [checklistCollapsed, setChecklistCollapsed] = useState(true);
  return (
    <ActionEditor
      editor={editor}
      lookups={lookups}
      action={task}
      saving={admin.isCreating || admin.isUpdating}
      mode={{
        isNew: false,
        cohortParseFailed: admin.cohortExpressionError != null,
        hideStaffPreview: record === RecordId.ProjectTask,
        checklist: (
          <ActionReadinessChecklist
            action={task}
            taskForm={taskForm}
            collapsed={checklistCollapsed}
            onCollapsedChange={setChecklistCollapsed}
          />
        ),
      }}
    />
  );
}

/** The create form at `/tasks/new`: the same fields as Details. */
export function NewTaskForm({ admin, editor, lookups }: NewTaskProps) {
  const navigate = useNavigate();
  return (
    <ActionEditor
      editor={editor}
      lookups={lookups}
      action={null}
      saving={admin.isCreating || admin.isUpdating}
      mode={{
        isNew: true,
        onCancel: () =>
          void navigate(tabHref(placeById(PlaceId.AllTasks), { view: "list" })),
      }}
    />
  );
}
