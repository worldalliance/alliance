import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import {
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router";
import { actionPhase } from "../../../lib/actionPhase";
import { projectHref, taskHref } from "../../../lib/hrefs";
import { RecordId, TabParam } from "../../../places";
import { parseTaskId } from "../TaskPage";
import { TaskRecord } from "../TaskRecord";
import { RENAMED_TASK_TABS } from "../taskTabs";
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
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const admin = useActionAdmin(actionId);
  const task = admin.action;

  const renamed = RENAMED_TASK_TABS.get(searchParams.get(TabParam.Tab) ?? "");
  if (renamed) {
    const next = new URLSearchParams(searchParams);
    next.set(TabParam.Tab, renamed);
    return (
      <Navigate
        replace
        to={{
          pathname: location.pathname,
          search: `?${next}`,
          hash: location.hash,
        }}
      />
    );
  }
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
