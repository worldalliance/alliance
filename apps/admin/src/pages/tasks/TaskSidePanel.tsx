import { useFormDisplaySlugs } from "@alliance/shared/lib/useFormsAdmin";
import { useId } from "react";
import { Link } from "react-router";
import { ActionCategoryIcons } from "../../components/ActionCategoryIcons";
import { SlugField } from "../../components/SlugField";
import {
  cohortNames,
  cohortSegmentsText,
  describeCohortExpression,
} from "../../lib/describeCohortExpression";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { suiteHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { placeById, PlaceId, tabHref } from "../../places";
import Badge from "../../ui/Badge";
import { cn } from "../../ui/cn";
import PhaseBadge from "../../ui/PhaseBadge";
import { linkClass } from "../../ui/styles";
import { Fact, FactList, SidePanelSection } from "../../ui/templates/Record";
import { taskVisibility } from "./taskFacts";
import { TaskPhases } from "./TaskPhases";
import { TaskProjectPicker } from "./TaskProjectPicker";
import type { TaskTabProps } from "./taskTabs";

export const COPY_GUIDELINES_URL =
  "https://docs.google.com/document/d/1vxeA31milcWRhpkGjGWHp1RQbpDFRjS541E9SzdKkFc/edit?usp=sharing";

const launchTime = (instant: string | null) =>
  instant
    ? formatDateTime(instant, { weekday: true, timeZone: LAUNCH_TIME_ZONE })
    : "—";

function TabLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" className={cn(linkClass, "w-fit")} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * The task's standing facts beside every tab. Read-only but for the project,
 * which today's picker saves at once; the rest link to the tab that edits them.
 */
export function TaskSidePanel({
  task,
  admin,
  lookups,
  openTab,
  extra,
}: Pick<TaskTabProps, "task" | "admin" | "lookups" | "openTab"> & {
  /** Sections only some routes show, after the facts. */
  extra?: React.ReactNode;
}) {
  const projectLabelId = useId();
  const formDisplaySlugs = useFormDisplaySlugs();
  const visibility = taskVisibility(task);
  const cohort = admin.cohortExpressionError
    ? "Couldn't read the cohort"
    : cohortSegmentsText(
        describeCohortExpression(
          task.cohortExpression,
          cohortNames({
            tags: lookups.availableTags,
            actions: lookups.allActions,
            formDisplaySlugs,
          }),
        ),
      );
  const editDetails = () => openTab("details");

  return (
    <>
      <SidePanelSection title="Phase">
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
          <PhaseBadge status={task.status} />
          {task.archived && <Badge>Archived</Badge>}
        </div>
        <TaskPhases events={task.events} />
        <TabLink onClick={() => openTab("events")}>Open events</TabLink>
      </SidePanelSection>

      <SidePanelSection title="Details">
        <FactList>
          <Fact label="Suite">
            {task.suite ? (
              <Link to={suiteHref(task.suite.id)} className={linkClass}>
                {task.suite.name}
              </Link>
            ) : (
              "None"
            )}
          </Fact>
          <Fact label="Categories">
            {task.category.length > 0 ? (
              <ActionCategoryIcons categories={task.category} />
            ) : (
              "None"
            )}
          </Fact>
          <Fact label="Starts">{launchTime(task.memberActionStart)}</Fact>
          <Fact label="Deadline">{launchTime(task.memberActionDeadline)}</Fact>
          <Fact label="Form">
            {task.taskFormId === null ? (
              "None"
            ) : (
              <TabLink onClick={() => openTab("form")}>Open form</TabLink>
            )}
          </Fact>
          <Fact label="Priority">
            <Link
              to={tabHref(placeById(PlaceId.AllTasks), { view: "priority" })}
              className={linkClass}
            >
              {formatCount(task.priority)}
            </Link>
          </Fact>
          <Fact label="Cohort">
            <span className="line-clamp-3" title={cohort}>
              {cohort}
            </span>
          </Fact>
        </FactList>
        <div className="flex flex-col gap-1.5 pt-2">
          <span id={projectLabelId} className="text-fg-muted">
            Project
          </span>
          <TaskProjectPicker
            actionId={task.id}
            project={task.project ?? null}
            labelId={projectLabelId}
          />
        </div>
        <div className="pt-2">
          <TabLink onClick={editDetails}>Edit on Details</TabLink>
        </div>
      </SidePanelSection>

      <SidePanelSection title="Who can see it">
        <FactList>
          <Fact label="Once out of draft">{visibility.outOfDraft}</Fact>
          <Fact label="As a draft">{visibility.asDraft}</Fact>
          <Fact label="Open by link">
            {visibility.openByLink
              ? "Anyone, at any phase"
              : "Only those who can see it"}
          </Fact>
        </FactList>
        {visibility.notes.map((note) => (
          <p key={note} className="pt-1 text-caption text-fg-muted">
            {note}
          </p>
        ))}
        <div className="pt-2">
          <TabLink onClick={editDetails}>Change on Details</TabLink>
        </div>
      </SidePanelSection>

      <SidePanelSection title="Member page">
        <div className="flex flex-col gap-1 [&_button:first-child]:break-all [&_button:first-child]:text-left [&_input]:w-full">
          <span className="text-fg-muted">Slug</span>
          <SlugField
            slug={task.slug}
            saving={admin.isUpdating}
            onSave={(slug) => admin.updateAction({ slug })}
          />
        </div>
      </SidePanelSection>
      {extra}
    </>
  );
}
