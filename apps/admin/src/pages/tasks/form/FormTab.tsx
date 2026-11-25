import { FormBuilder } from "../../../components/FormBuilder";
import type { TaskTabProps } from "../taskTabs";

export function FormTab({ task, editor }: TaskTabProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-page pt-section pb-12">
      <FormBuilder
        formId={task.taskFormId ?? undefined}
        setFormId={editor.setTaskFormId}
        actionName={task.name}
        taskFlow
      />
    </div>
  );
}
