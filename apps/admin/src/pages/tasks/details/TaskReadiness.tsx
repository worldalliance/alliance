import type { useAdminTaskForm } from "@alliance/shared/lib/useTaskForm";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useMemo } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import Badge, { BadgeTone } from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { Panel } from "../../../ui/templates/Overview";
import { LOAD_FAILED_FALLBACK } from "../../../ui/templates/States";
import { actionReadinessItems } from "../../action-dashboard/actionReadiness";
import { taskFormWithSchema } from "../../action-dashboard/useActionReporting";

type TaskFormQuery = Pick<ReturnType<typeof useAdminTaskForm>, "data"> & {
  isLoadingError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
};

const NEEDS_TASK_FORM = new Set(["outputView", "readingTime"]);

/**
 * The task's readiness checklist. Advisory here; the suite's Launch tab makes
 * staff tick or dismiss each unfinished item, so it is a standalone task's
 * only review before launch and always shows in full.
 */
export function TaskReadiness({
  task,
  taskForm,
}: {
  task: ParsedActionDto;
  taskForm: TaskFormQuery;
}) {
  const schema = taskFormWithSchema(taskForm)?.schema ?? null;
  const items = useMemo(
    () => actionReadinessItems(task, schema),
    [task, schema],
  );
  const formUnknown = task.taskFormId != null && schema === null;
  const unchecked = (id: string) => formUnknown && NEEDS_TASK_FORM.has(id);
  const ready = items.filter(
    (item) => item.isReady && !unchecked(item.id),
  ).length;
  return (
    <Panel title="Readiness" description={`${ready} of ${items.length} ready`}>
      <div className="flex flex-col gap-3">
        {formUnknown && taskForm.isLoadingError && (
          <Banner
            tone={BannerTone.Danger}
            inline
            action={
              <Button
                size="small"
                variant={ButtonVariant.Ghost}
                busy={taskForm.isFetching}
                onClick={() => void taskForm.refetch()}
              >
                Try again
              </Button>
            }
          >
            Couldn't load the task form, so its output view and reading time
            aren't checked.{" "}
            {adminRefusalMessage(taskForm.error, LOAD_FAILED_FALLBACK)}
          </Banner>
        )}
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              {unchecked(item.id) ? (
                <Badge tone={BadgeTone.Neutral} className="shrink-0">
                  {taskForm.isLoadingError ? "—" : "Loading…"}
                </Badge>
              ) : (
                <Badge
                  tone={item.isReady ? BadgeTone.Success : BadgeTone.Warning}
                  className="shrink-0"
                >
                  {item.isReady ? "Ready" : "Not ready"}
                </Badge>
              )}
              <span className="min-w-0">
                {unchecked(item.id) && item.id === "readingTime"
                  ? "Total reading time: —"
                  : item.label}
                {item.required && (
                  <span className="text-caption text-fg-muted">
                    {" "}
                    · Required for staff testing
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
