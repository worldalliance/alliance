import type { useAdminTaskForm } from "@alliance/shared/lib/useTaskForm";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { TaskReadiness } from "../tasks/details/TaskReadiness";

/**
 * BACKCOMPAT(project-task-page): today's props for `pages/ProjectActionPage.tsx`.
 * The checklist now always shows in full, so `collapsed` is not read. Delete
 * once that page renders the task record.
 */
export default function ActionReadinessChecklist({
  action,
  taskForm,
}: {
  action: ParsedActionDto | null;
  taskForm: ReturnType<typeof useAdminTaskForm>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  return action && <TaskReadiness task={action} taskForm={taskForm} />;
}
