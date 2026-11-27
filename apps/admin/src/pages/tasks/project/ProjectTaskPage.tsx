import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { Navigate, useLocation, useParams } from "react-router";
import { actionPhase } from "../../../lib/actionPhase";
import { projectHref, taskHref } from "../../../lib/hrefs";
import { RecordId } from "../../../places";
import { parseTaskId } from "../TaskPage";
import { TaskRecord } from "../TaskRecord";
import { useRenamedTabRedirect } from "../useRenamedTabRedirect";
import { ReleaseSection } from "./ReleaseSection";
import { StaffTestingSection } from "./StaffTestingSection";

/**
 * `/tasks/projects/:projectId/tasks/:actionId`: the task record with its
 * breadcrumb through its project, and the release only a project task has.
 */
export default function ProjectTaskPage() {
  const params = useParams();
  const projectId = parseTaskId(params.projectId);
  const actionId = parseTaskId(params.actionId);
  const location = useLocation();
  const admin = useActionAdmin(actionId);
  const task = admin.action;

  const redirect = useRenamedTabRedirect();
  if (redirect) return redirect;
  if (task && task.project?.id !== projectId) {
    const suffix = `${location.search}${location.hash}`;
    return (
      <Navigate
        replace
        to={
          (task.project
            ? `${projectHref(task.project.id)}/tasks/${task.id}`
            : taskHref(task.id)) + suffix
        }
      />
    );
  }

  return (
    <TaskRecord
      route={{ kind: "task", actionId }}
      record={RecordId.ProjectTask}
      parents={
        task?.project
          ? [{ label: task.project.name, to: projectHref(task.project.id) }]
          : undefined
      }
      sideExtra={(context) => {
        if (!task) return null;
        const phase = actionPhase(task, new Date());
        return (
          <>
            <StaffTestingSection
              action={task}
              phase={phase}
              context={context}
            />
            <ReleaseSection
              action={task}
              phase={phase}
              disabled={context.unsaved}
              onOpenEvents={() => context.openTab("events")}
            />
          </>
        );
      }}
    />
  );
}
