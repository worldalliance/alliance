import { FormBuilder } from "../../../components/FormBuilder";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import type { TaskTabProps } from "../taskTabs";

/**
 * The builder takes the tab's full width and height. Saving a form stores a
 * new snapshot that members get on their next load, whatever the task's phase
 * (`server/src/tasks/tasks.controller.ts` `updateFormAdmin`).
 */
export function FormTab({
  task,
  editor,
}: Pick<TaskTabProps, "task" | "editor">) {
  const draft = task.status === "draft";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Banner tone={draft ? BannerTone.Info : BannerTone.Warning}>
        {draft
          ? "Forms have no draft or publish step: a save is stored at once, and members get it on their next load once they can see this task."
          : "Forms have no draft or publish step: a save here is live for members on their next load of this task."}
      </Banner>
      <FormBuilder
        formId={task.taskFormId ?? undefined}
        setFormId={editor.setTaskFormId}
        actionName={task.name}
        task={{ id: task.id, name: task.name }}
        taskFlow
      />
    </div>
  );
}
