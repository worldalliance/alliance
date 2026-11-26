import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useMemo } from "react";
import { Link } from "react-router";
import { ActionCategoryPicker } from "../../../components/ActionCategoryIcons";
import { stepPath } from "../../../components/ProjectStepRows";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { formatDate } from "../../../lib/formatDate";
import { countOf, formatCount } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { allStepsOf, type ProjectStep } from "../../../lib/projectCards";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import {
  useDeleteProjectAdmin,
  useProjectAdmin,
  useUpdateProjectAdmin,
} from "../../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Skeleton } from "../../../ui/Skeleton";
import { linkClass } from "../../../ui/styles";
import { Panel, PanelNote, PanelStack } from "../../../ui/templates/Overview";
import {
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../../ui/templates/States";
import type { TaskTabProps } from "../taskTabs";

const pacificDate = (date: string | null) =>
  date ? formatDate(date, { timeZone: LAUNCH_TIME_ZONE }) : null;

/** When members take action on the step, in Pacific time. */
const stepDates = (step: ProjectStep) => {
  const start = pacificDate(step.memberActionStart);
  if (!start) return "Unscheduled";
  const deadline = pacificDate(step.memberActionDeadline);
  return deadline ? `${start} – ${deadline}` : `From ${start}`;
};

/**
 * The project the task belongs to: its categories, which save at once, its
 * steps in order with which one this task is, and Delete project behind a
 * confirm.
 */
export function TaskProjectPanel({
  projectId,
  taskId,
  setError,
  onDeleted,
}: {
  projectId: number;
  taskId: number;
  setError: TaskTabProps["setError"];
  /** The panel unmounts once the task refetches without its project. */
  onDeleted: () => void;
}) {
  const confirm = useConfirmOnPage();
  const project = useProjectAdmin(projectId);
  const actions = useActionsAdmin();
  const remove = useDeleteProjectAdmin({
    onSuccess: () => {
      setError(null);
      onDeleted();
    },
    onError: (error) =>
      setError(adminRefusalMessage(error, "Couldn't delete the project.")),
  });
  const updateCategory = useUpdateProjectAdmin({
    onSuccess: () => setError(null),
    onError: (error) =>
      setError(
        adminRefusalMessage(error, "Couldn't change the project's categories."),
      ),
  });
  const card = useMemo(
    () =>
      actions.data ? allStepsOf({ projectId, actions: actions.data }) : null,
    [projectId, actions.data],
  );
  const stepNumber =
    (card?.steps.findIndex((step) => step.id === taskId) ?? -1) + 1;

  const deleteProject = async (name: string, taskCount: number) => {
    const confirmed = await confirm({
      title: `Delete the project “${name}”?`,
      message: `Its ${countOf(taskCount, "task")} will no longer belong to a project, and members stop seeing the project's name on them. The tasks themselves are not deleted.`,
      confirmLabel: "Delete project",
      destructive: true,
    });
    if (confirmed) remove.mutate(projectId);
  };

  return (
    <Panel
      title={project.data ? `Project: ${project.data.name}` : "Project"}
      action={
        project.data && (
          <Button
            variant={ButtonVariant.DangerOutline}
            size="small"
            busy={remove.isPending}
            disabled={remove.isSuccess}
            onClick={() => {
              if (project.data) {
                void deleteProject(
                  project.data.name,
                  project.data.steps.length,
                );
              }
            }}
          >
            Delete project…
          </Button>
        )
      }
    >
      {project.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : project.isLoadingError ? (
        <PanelNote>
          Couldn't load the project.{" "}
          {adminRefusalMessage(project.error, LOAD_FAILED_FALLBACK)}
        </PanelNote>
      ) : (
        <PanelStack>
          <RefreshFailedBanner inline things="the project" query={project} />
          <RefreshFailedBanner
            inline
            things="the project's tasks"
            query={actions}
          />
          <div className="flex items-center gap-3">
            <span className="text-caption font-medium text-fg-muted">
              Categories
            </span>
            <ActionCategoryPicker
              value={project.data.category}
              onChange={(category) =>
                updateCategory.mutate({ id: projectId, body: { category } })
              }
              disabled={updateCategory.isPending}
            />
          </div>
          {card ? (
            <>
              {stepNumber > 0 && (
                <p className="text-caption text-fg-muted">
                  This task is step {stepNumber} of {card.steps.length}.
                </p>
              )}
              {card.steps.length === 0 ? (
                <PanelNote>The project has no tasks yet.</PanelNote>
              ) : (
                <ol className="flex flex-col gap-1">
                  {card.steps.map((step, index) => (
                    <li key={step.id} className="flex items-baseline gap-2">
                      <span className="w-5 shrink-0 text-right text-caption tabular-nums text-fg-muted">
                        {index + 1}
                      </span>
                      {step.id === taskId ? (
                        <span
                          aria-current="step"
                          className="min-w-0 font-medium break-words"
                        >
                          {step.name}
                        </span>
                      ) : (
                        <Link
                          to={stepPath(step)}
                          className={cn(linkClass, "min-w-0 break-words")}
                        >
                          {step.name}
                        </Link>
                      )}
                      <span className="ml-auto shrink-0 text-right text-caption tabular-nums text-fg-muted">
                        {stepDates(step)} · {formatCount(step.usersCompleted)}{" "}
                        completed
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : actions.isLoadingError ? (
            <PanelNote>Couldn't load the project's tasks.</PanelNote>
          ) : (
            <Skeleton className="h-16 w-full" />
          )}
        </PanelStack>
      )}
    </Panel>
  );
}
