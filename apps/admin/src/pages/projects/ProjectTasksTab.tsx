import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { stepPath } from "../../components/ProjectStepRows";
import { ActionPhase, actionPhase } from "../../lib/actionPhase";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  cohortSegmentsText,
  type CohortSegment,
} from "../../lib/describeCohortExpression";
import { formatCount } from "../../lib/formatNumber";
import { projectTaskHref, suiteHref } from "../../lib/hrefs";
import type { ProjectCard, ProjectStep } from "../../lib/projectCards";
import {
  ActionEditorSection,
  missingForStaffTesting,
} from "../../lib/staffTestingGate";
import {
  useAssignActionProjectAdmin,
  useStartStaffTestingAdmin,
} from "../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { EmptyState } from "../../ui/EmptyState";
import { MoreMenu } from "../../ui/MoreMenu";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";
import { percent, stepDates } from "./projectRules";
import type { SuiteGroup } from "./projectSuites";
import { StepBadges } from "./stepPieces";

const COLUMNS = 4;
const SAVING = "Another change is saving";

/** What a draft task still lacks before staff testing can start. */
function StaffTestingNeeds({
  missing,
  label,
}: {
  missing: string[];
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="rounded-sm text-caption text-fg-muted underline decoration-dotted focus-ring"
        aria-label={`Staff testing needs, for ${label}: ${missing.join(", ")}`}
      >
        Needs {formatCount(missing.length)}
      </TooltipTrigger>
      <TooltipContent>Needs: {missing.join(", ")}</TooltipContent>
    </Tooltip>
  );
}

/** Each of the project's tasks, grouped by suite, with what to do next. */
export function ProjectTasksTab({
  card,
  projectId,
  groups,
  participantsById,
  now,
  onError,
  onAddTask,
}: {
  card: ProjectCard;
  projectId: number;
  groups: SuiteGroup[];
  participantsById: ReadonlyMap<number, CohortSegment[]>;
  now: Date;
  onError: (message: string | null) => void;
  onAddTask: () => void;
}) {
  const navigate = useNavigate();
  const startStaffTesting = useStartStaffTestingAdmin({
    onError: (error) =>
      onError(adminRefusalMessage(error, "Couldn't start staff testing.")),
  });
  const assign = useAssignActionProjectAdmin({
    onError: (error) =>
      onError(
        adminRefusalMessage(
          error,
          "Couldn't remove the task from the project.",
        ),
      ),
  });
  // One write at a time: each mutation keeps only its latest call's variables
  // and onSuccess, so a second write would hide the first's spinner and focus.
  const writing = startStaffTesting.isPending || assign.isPending;
  const funnelById = new Map(card.funnel.map((entry) => [entry.stepId, entry]));
  const nameCounts = new Map<string, number>();
  for (const { name } of card.steps) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const shown = groups.flatMap((group) => group.steps);
  const tableRef = useRef<HTMLTableElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // After Remove from project, focus goes to the next row's More, else the
  // previous row's, else Add task once the table is empty.
  const [focusAfter, setFocusAfter] = useState<number | "add" | null>(null);

  useEffect(() => {
    if (focusAfter === null) return;
    const target =
      focusAfter === "add"
        ? addRef.current
        : tableRef.current?.querySelector<HTMLElement>(
            `[data-step="${focusAfter}"] [aria-label^="More:"]`,
          );
    if (!target) return;
    target.focus();
    setFocusAfter(null);
  }, [focusAfter, card.steps]);

  const remove = (step: ProjectStep) => {
    const index = shown.findIndex((candidate) => candidate.id === step.id);
    const next = shown[index + 1] ?? shown[index - 1];
    onError(null);
    assign.mutate(
      { actionId: step.id, projectId: null },
      { onSuccess: () => setFocusAfter(next ? next.id : "add") },
    );
  };

  if (card.steps.length === 0) {
    return (
      <EmptyState
        title="No tasks in this project yet"
        description="Create a task here, or add one that already exists."
        action={
          <Button
            ref={addRef}
            variant={ButtonVariant.Default}
            onClick={onAddTask}
          >
            Add task…
          </Button>
        }
      />
    );
  }

  return (
    <Panel title="Tasks by suite" flush>
      <Table ref={tableRef}>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Phase and member dates</TableHead>
            <TableHead className="text-right">Completed</TableHead>
            <TableHead actions>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <GroupRows
              key={group.suite?.id ?? "none"}
              group={group}
              render={(step) => {
                // The funnel compares each task with the one before it in the
                // project's order, which grouping can move away from the row above.
                const inFunnel = card.funnel.findIndex(
                  (entry) => entry.stepId === step.id,
                );
                const position = inFunnel + 1;
                const previousShownAbove =
                  card.funnel[inFunnel - 1]?.stepId ===
                  shown[shown.findIndex(({ id }) => id === step.id) - 1]?.id;
                const label =
                  (nameCounts.get(step.name) ?? 0) > 1
                    ? `${step.name}, task ${position}`
                    : step.name;
                const phase = actionPhase(step, now);
                const missing =
                  phase === ActionPhase.Draft
                    ? missingForStaffTesting(step).map((item) => item.label)
                    : [];
                const participants = participantsById.get(step.id);
                const cohort = participants && cohortSegmentsText(participants);
                const funnel = funnelById.get(step.id);
                return (
                  <TableRow key={step.id} data-step={step.id}>
                    <TableCell className="min-w-48">
                      <span
                        className="mr-1.5 text-fg-muted tabular-nums"
                        title="Order in the project"
                      >
                        {position}
                      </span>
                      <Link
                        to={stepPath(step)}
                        className={cn(nameLinkClass, "font-medium")}
                      >
                        {step.name}
                      </Link>
                      {cohort && (
                        <div
                          className="mt-1 line-clamp-2 text-caption text-fg-muted"
                          title={cohort}
                        >
                          {cohort}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <StepBadges step={step} now={now} />
                        {missing.length > 0 && (
                          <StaffTestingNeeds missing={missing} label={label} />
                        )}
                      </span>
                      <div className="mt-1 text-caption text-fg-muted">
                        {stepDates(step)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatCount(funnel?.completions ?? 0)}
                      {funnel?.retention != null && previousShownAbove && (
                        <span className="text-fg-muted">
                          {" "}
                          · {percent(funnel.retention)} of previous
                        </span>
                      )}
                      <div className="text-caption text-fg-muted">
                        {formatCount(step.usersWontComplete)} won't ·{" "}
                        {formatCount(step.usersDismissed)} dismissed
                      </div>
                    </TableCell>
                    <TableCell actions>
                      <MoreMenu
                        subject={label}
                        size="small"
                        compact
                        busy={
                          (startStaffTesting.isPending &&
                            startStaffTesting.variables === step.id) ||
                          (assign.isPending &&
                            assign.variables.actionId === step.id)
                        }
                        items={[
                          ...(phase === ActionPhase.Draft
                            ? [
                                {
                                  label: "Start staff testing",
                                  disabledReason:
                                    missing.length > 0
                                      ? `Needs: ${missing.join(", ")}`
                                      : writing
                                        ? SAVING
                                        : undefined,
                                  onSelect: () => {
                                    onError(null);
                                    startStaffTesting.mutate(step.id);
                                  },
                                },
                              ]
                            : []),
                          ...(phase === ActionPhase.StaffTesting
                            ? [
                                {
                                  label: "Schedule release…",
                                  onSelect: () =>
                                    void navigate(
                                      projectTaskHref({
                                        projectId,
                                        actionId: step.id,
                                        hash: ActionEditorSection.Release,
                                      }),
                                    ),
                                },
                              ]
                            : []),
                          {
                            label: "Remove from project",
                            disabledReason: writing ? SAVING : undefined,
                            onSelect: () => remove(step),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              }}
            />
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

function GroupRows({
  group,
  render,
}: {
  group: SuiteGroup;
  render: (step: ProjectStep) => React.ReactNode;
}) {
  return (
    <>
      <TableGroupRow
        colSpan={COLUMNS}
        label={
          group.suite ? (
            <Link to={suiteHref(group.suite.id)} className={nameLinkClass}>
              {group.suite.name}
            </Link>
          ) : (
            "No suite"
          )
        }
        count={group.steps.length}
      />
      {group.steps.map(render)}
    </>
  );
}
