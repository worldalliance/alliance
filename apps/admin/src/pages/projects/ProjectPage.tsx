import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { href, useNavigate, useParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { buildProjectCard, type ProjectCard } from "../../lib/projectCards";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useDeleteProjectAdmin } from "../../lib/useProjectsAdmin";
import {
  ProjectsLoad,
  useProjectsPageData,
} from "../../lib/useProjectsPageData";
import { RecordId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { MoreMenu } from "../../ui/MoreMenu";
import { ProjectSwatch } from "../../ui/ProjectSwatch";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page } from "../../ui/templates/Page";
import { RecordBody } from "../../ui/templates/Record";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useRecordTabs } from "../../ui/templates/usePlaceTabs";
import { useToast } from "../../ui/ToastProvider";
import { AddTaskDialog } from "./AddTaskDialog";
import { EditProjectDialog } from "./EditProjectDialog";
import { NewProjectTaskDialog } from "./NewProjectTaskDialog";
import { ProjectSide } from "./ProjectSide";
import { type SuiteGroup, tasksBySuite } from "./projectSuites";
import { ProjectTasksTab } from "./ProjectTasksTab";
import { ProjectTimelineTab } from "./ProjectTimelineTab";
import { ProjectUpdatesTab } from "./ProjectUpdatesTab";
import { taskCount } from "./stepPieces";

const TABS = ["tasks", "timeline", "project-updates"] as const;
type Tab = (typeof TABS)[number];

enum Opened {
  NewTask = "new-task",
  AddTask = "add-task",
  Edit = "edit",
}

const sideSkeleton = (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 5 }, (_, row) => (
      <Skeleton key={row} className="h-5 w-full" />
    ))}
  </div>
);

const SKELETON = (
  <RecordBody side={sideSkeleton}>
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <TableSkeleton columns={6} rows={5} />
    </div>
  </RecordBody>
);

const projectsHref = href("/tasks/projects");

/** "Project · 5 tasks across 3 suites". */
const headerFacts = (params: { card: ProjectCard; groups: SuiteGroup[] }) => {
  const tasks = taskCount(params.card.steps.length);
  const suites = params.groups.filter((group) => group.suite).length;
  return [
    "Project",
    suites > 0 ? `${tasks} across ${countOf(suites, "suite")}` : tasks,
  ].join(" · ");
};

export default function ProjectPage() {
  const projectId = Number(useParams().projectId);
  const validId = Number.isInteger(projectId);
  const navigate = useNavigate();
  const tabs = useRecordTabs(RecordId.Project, TABS);
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const data = useProjectsPageData();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const ready = data.load === ProjectsLoad.Ready;
  const project = ready
    ? data.projects.find((candidate) => candidate.id === projectId)
    : undefined;
  const now = new Date();
  const card =
    ready && project
      ? buildProjectCard({ project, actions: data.actions, now })
      : null;
  const groups =
    ready && card
      ? tasksBySuite({ steps: card.steps, actions: data.actions })
      : [];

  const deletion = useDeleteProjectAdmin({
    onSuccess: () => {
      if (project) success("Project deleted", project.name);
    },
    onError: (error) =>
      setWriteError(adminRefusalMessage(error, "Couldn't delete the project.")),
  });

  // Leaving from an effect lets the empty render below go first, so the
  // refetched list doesn't flash "Project not found".
  useEffect(() => {
    if (deletion.isSuccess) void navigate(projectsHref);
  }, [deletion.isSuccess, navigate]);
  if (deletion.isSuccess) return null;

  const deleteProject = async () => {
    if (!project || !card) return;
    const confirmed = await confirm({
      title: `Delete the project “${project.name}”?`,
      message: `${
        card.steps.length === 0
          ? "It has no tasks."
          : `Its ${taskCount(card.steps.length)} stay as they are, in no project.`
      } Members no longer see the project's name on them. No one is notified.`,
      confirmLabel: "Delete project",
      destructive: true,
    });
    if (!confirmed) return;
    setWriteError(null);
    deletion.mutate(project.id);
  };

  const body: Record<Tab, (shown: ProjectCard) => ReactNode> = {
    tasks: (shown) => (
      <ProjectTasksTab
        card={shown}
        projectId={projectId}
        groups={groups}
        participantsById={ready ? data.participantsById : new Map()}
        now={now}
        onError={setWriteError}
        onAddTask={() => setOpened(Opened.AddTask)}
      />
    ),
    timeline: (shown) => (
      <ProjectTimelineTab card={shown} projectId={projectId} now={now} />
    ),
    "project-updates": (shown) => (
      <ProjectUpdatesTab
        card={shown}
        updates={data.updatesQuery.data ?? []}
        now={now}
      />
    ),
  };

  return (
    <Page
      record={RecordId.Project}
      title={project?.name}
      badge={project && <ProjectSwatch projectId={project.id} />}
      description={card ? headerFacts({ card, groups }) : ""}
      actions={
        project && (
          <>
            <Button
              variant={ButtonVariant.Default}
              onClick={() => setOpened(Opened.AddTask)}
            >
              Add task…
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              onClick={() => setOpened(Opened.NewTask)}
            >
              New task…
            </Button>
            <MoreMenu
              busy={deletion.isPending}
              items={[
                {
                  label: "Edit name and slug…",
                  onSelect: () => setOpened(Opened.Edit),
                },
                {
                  label: "Delete project…",
                  onSelect: () => void deleteProject(),
                  destructive: true,
                },
              ]}
            />
          </>
        )
      }
      tabs={tabs}
      banner={
        <>
          <RefreshFailedBanner
            parts={[
              { things: "projects", query: data.projectsQuery },
              { things: "tasks", query: data.actionsQuery },
              { things: "project updates", query: data.updatesQuery },
            ]}
          />
          {writeError && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={() => setWriteError(null)}
                >
                  Dismiss
                </Button>
              }
            >
              {writeError}
            </Banner>
          )}
        </>
      }
    >
      <ContentState
        loading={validId && data.load === ProjectsLoad.Pending}
        skeleton={SKELETON}
        error={validId && data.load === ProjectsLoad.Failed ? data.error : null}
        errorTitle="Couldn't load this project"
        onRetry={data.retry}
        retrying={data.retrying}
        empty={!card}
        emptyTitle="Project not found"
        emptyDescription="It may have been deleted."
        emptyAction={
          <Button variant={ButtonVariant.Default} to={projectsHref}>
            All projects
          </Button>
        }
      >
        {card && project && (
          <RecordBody
            side={
              <ProjectSide
                project={project}
                card={card}
                groups={groups}
                onError={setWriteError}
              />
            }
          >
            {body[tabs.value](card)}
          </RecordBody>
        )}
      </ContentState>
      {project && opened === Opened.NewTask && (
        <NewProjectTaskDialog
          projectId={project.id}
          onClose={() => setOpened(null)}
        />
      )}
      {project && ready && opened === Opened.AddTask && (
        <AddTaskDialog
          project={project}
          actions={data.actions}
          onClose={() => setOpened(null)}
        />
      )}
      {project && opened === Opened.Edit && (
        <EditProjectDialog project={project} onClose={() => setOpened(null)} />
      )}
    </Page>
  );
}
