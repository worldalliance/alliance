import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import type { ReactNode } from "react";
import { TaskDetailsForm } from "../tasks/details/TaskDetailsForm";
import type { TaskLookups } from "../tasks/taskTabs";
import type { ActionEditorState } from "./useActionEditor";

/**
 * BACKCOMPAT(project-task-page): today's props for `pages/ProjectActionPage.tsx`,
 * over the task record's Details form. Delete once that page renders the task
 * record.
 */
export default function ActionEditor({
  editor,
  lookups,
  action,
  saving,
  mode,
}: {
  editor: ActionEditorState;
  lookups: TaskLookups;
  action: ParsedActionDto | null;
  saving: boolean;
  mode:
    | { isNew: true; onCancel: () => void }
    | {
        isNew: false;
        cohortParseFailed: boolean;
        checklist: ReactNode;
        hideStaffPreview?: boolean;
      };
}) {
  return (
    <div className="flex flex-col gap-section">
      {!mode.isNew && mode.checklist}
      <TaskDetailsForm
        editor={editor}
        lookups={lookups}
        task={action}
        saving={saving}
        cohortParseFailed={!mode.isNew && mode.cohortParseFailed}
        hideStaffPreview={!mode.isNew && mode.hideStaffPreview}
      />
    </div>
  );
}
