import { useAdminTaskForm } from "@alliance/shared/lib/useTaskForm";
import { RecordId } from "../../../places";
import type { NewTaskProps, TaskTabProps } from "../taskTabs";
import { TaskDetailsForm } from "./TaskDetailsForm";
import { TaskReadiness } from "./TaskReadiness";

export function DetailsTab({
  task,
  record,
  admin,
  editor,
  lookups,
}: TaskTabProps) {
  const taskForm = useAdminTaskForm(task.taskFormId);
  return (
    <>
      <TaskReadiness task={task} taskForm={taskForm} />
      <TaskDetailsForm
        editor={editor}
        lookups={lookups}
        task={task}
        saving={admin.isUpdating}
        cohortParseFailed={admin.cohortExpressionError != null}
        hideStaffPreview={record === RecordId.ProjectTask}
      />
    </>
  );
}

/** The create form at `/tasks/new`: the same fields as Details. */
export function NewTaskForm({ admin, editor, lookups }: NewTaskProps) {
  return (
    <TaskDetailsForm
      editor={editor}
      lookups={lookups}
      task={null}
      saving={admin.isCreating}
    />
  );
}
