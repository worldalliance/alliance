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
  const unchecked = formUnknown
    ? items.filter((item) => NEEDS_TASK_FORM.has(item.id))
    : [];
  const ready = items.filter(
    (item) => item.isReady && !unchecked.includes(item),
  );
  const open = items.filter(
    (item) => !item.isReady && !unchecked.includes(item),
  );
  return (
    <Panel
      title="Readiness"
      description={`${ready.length} of ${items.length} ready`}
    >
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
        {open.length > 0 && (
          <ul aria-label="Not ready" className="flex flex-col gap-2">
            {open.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <Badge tone={BadgeTone.Warning} className="shrink-0">
                  Not ready
                </Badge>
                <span className="min-w-0">
                  {item.label}
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
        )}
        {unchecked.length > 0 && (
          <ul aria-label="Not checked" className="flex flex-col gap-2">
            {unchecked.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <Badge tone={BadgeTone.Neutral} className="shrink-0">
                  {taskForm.isLoadingError ? "—" : "Loading…"}
                </Badge>
                <span className="min-w-0">
                  {item.id === "readingTime"
                    ? "Total reading time: —"
                    : item.label}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ready.length > 0 && (
          <p className="flex items-start gap-2.5">
            <Badge tone={BadgeTone.Success} className="shrink-0">
              Ready
            </Badge>
            <span className="min-w-0 text-fg-muted">
              {ready.map((item) => item.label).join(" · ")}
            </span>
          </p>
        )}
      </div>
    </Panel>
  );
}
