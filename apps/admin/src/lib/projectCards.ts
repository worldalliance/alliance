import { eventInEffectAt } from "@alliance/common/actionEvent";
import type {
  ActionStatus,
  AdminActionListItemDto,
  AdminProjectDto,
} from "@alliance/shared/client";
import { addDays, addHours, isAfter, isBefore } from "date-fns";

export enum ProjectLifecycle {
  Live = "live",
  Upcoming = "upcoming",
  InTheWorks = "in_the_works",
  Awaiting = "awaiting",
  Done = "done",
}

export const PROJECT_LIFECYCLE_ORDER = [
  ProjectLifecycle.Live,
  ProjectLifecycle.Upcoming,
  ProjectLifecycle.InTheWorks,
  ProjectLifecycle.Awaiting,
  ProjectLifecycle.Done,
] as const satisfies readonly ProjectLifecycle[];

export enum StepCountBucket {
  Live = "live",
  Planned = "planned",
  Draft = "draft",
  WrappingUp = "wrapping_up",
  Done = "done",
}

export const STEP_COUNT_BUCKET: Record<ActionStatus, StepCountBucket> = {
  member_action: StepCountBucket.Live,
  planned: StepCountBucket.Planned,
  draft: StepCountBucket.Draft,
  office_action: StepCountBucket.WrappingUp,
  resolution: StepCountBucket.WrappingUp,
  completed: StepCountBucket.Done,
  failed: StepCountBucket.Done,
  abandoned: StepCountBucket.Done,
};

export enum ProjectFlagKind {
  Stuck = "stuck",
  NoUpdate = "no_update",
  DeadlineSoon = "deadline_soon",
  LaunchSoon = "launch_soon",
  GapBeforeNextStep = "gap_before_next_step",
}

export enum ProjectCardKind {
  Project = "project",
  Standalone = "standalone",
}

export type ProjectStep = Pick<
  AdminActionListItemDto,
  | "id"
  | "name"
  | "slug"
  | "status"
  | "events"
  | "project"
  | "archived"
  | "onboarding"
  | "updates"
  | "usersCompleted"
  | "usersWontComplete"
  | "usersDismissed"
  | "memberActionStart"
  | "memberActionDeadline"
  | "variantFormIds"
>;

export type ProjectFlag = {
  kind: ProjectFlagKind;
  step: Pick<ProjectStep, "id" | "name">;
  at: Date;
};

export type FunnelStep = {
  stepId: number;
  completions: number;
  /** Share of the previous step's completions; null for the first step or after a step nobody completed. */
  retention: number | null;
};

type CardSummary = {
  key: string;
  name: string;
  steps: ProjectStep[];
  lifecycle: ProjectLifecycle;
  startedAt: Date | null;
  counts: Record<StepCountBucket, number>;
  funnel: FunnelStep[];
  wontComplete: number;
  dismissed: number;
  flags: ProjectFlag[];
};

export type ProjectCard = CardSummary &
  (
    | { kind: ProjectCardKind.Project; project: AdminProjectDto }
    | { kind: ProjectCardKind.Standalone; action: ProjectStep }
  );

export const STALE_AFTER_DAYS = 21;
export const SOON_WITHIN_HOURS = 72;

const time = (date: string | null) =>
  date === null ? Infinity : new Date(date).getTime();

const byStepOrder = (a: ProjectStep, b: ProjectStep) =>
  time(a.memberActionStart) - time(b.memberActionStart) || a.id - b.id;

const LIFECYCLE_RULES: [ProjectLifecycle, (status: ActionStatus) => boolean][] =
  [
    [ProjectLifecycle.Live, (status) => status === "member_action"],
    [ProjectLifecycle.Upcoming, (status) => status === "planned"],
    [ProjectLifecycle.InTheWorks, (status) => status === "draft"],
    [
      ProjectLifecycle.Awaiting,
      (status) => status === "office_action" || status === "resolution",
    ],
  ];

const lifecycleOf = (steps: ProjectStep[]): ProjectLifecycle => {
  if (steps.length === 0) return ProjectLifecycle.InTheWorks;
  const match = LIFECYCLE_RULES.find(([, applies]) =>
    steps.some((step) => applies(step.status)),
  );
  return match ? match[0] : ProjectLifecycle.Done;
};

const postedUpdateTimes = (step: ProjectStep, now: Date) =>
  step.updates
    .map((update) => update.visibleAt)
    .filter((visibleAt) => visibleAt !== null)
    .map((visibleAt) => new Date(visibleAt))
    .filter((visibleAt) => !isAfter(visibleAt, now));

const stepFlags = (step: ProjectStep, now: Date): ProjectFlag[] => {
  const flags: ProjectFlag[] = [];
  const flag = (kind: ProjectFlagKind, at: Date) =>
    flags.push({ kind, step: { id: step.id, name: step.name }, at });
  const staleBefore = addDays(now, -STALE_AFTER_DAYS);
  const soonBefore = addHours(now, SOON_WITHIN_HOURS);
  const isSoon = (date: Date) =>
    isAfter(date, now) && !isAfter(date, soonBefore);
  const posted = postedUpdateTimes(step, now);
  const entered = eventInEffectAt(step.events, now).event;
  const enteredAt = entered ? new Date(entered.date) : null;

  if (
    (step.status === "office_action" || step.status === "resolution") &&
    enteredAt &&
    !isAfter(enteredAt, staleBefore) &&
    !posted.some((at) => !isBefore(at, enteredAt))
  ) {
    flag(ProjectFlagKind.Stuck, enteredAt);
  }
  if (
    step.status === "completed" &&
    enteredAt &&
    !isAfter(enteredAt, staleBefore) &&
    posted.length === 0
  ) {
    flag(ProjectFlagKind.NoUpdate, enteredAt);
  }
  const deadline = step.memberActionDeadline
    ? new Date(step.memberActionDeadline)
    : null;
  if (step.status === "member_action" && deadline && isSoon(deadline)) {
    flag(ProjectFlagKind.DeadlineSoon, deadline);
  }
  const start = step.memberActionStart
    ? new Date(step.memberActionStart)
    : null;
  if (start && isSoon(start)) {
    flag(ProjectFlagKind.LaunchSoon, start);
  }
  return flags;
};

const gapFlag = (steps: ProjectStep[]): ProjectFlag | null => {
  const scheduled = steps.filter((step) => step.memberActionStart !== null);
  const last = scheduled.at(-1);
  if (!last || last.status !== "member_action") return null;
  if (
    scheduled.some(
      (step) => time(step.memberActionStart) > time(last.memberActionStart),
    )
  ) {
    return null;
  }
  return {
    kind: ProjectFlagKind.GapBeforeNextStep,
    step: { id: last.id, name: last.name },
    at: new Date(last.memberActionDeadline ?? last.memberActionStart ?? 0),
  };
};

const funnelOf = (steps: ProjectStep[]): FunnelStep[] =>
  steps.map((step, index) => {
    const previous = steps[index - 1]?.usersCompleted;
    return {
      stepId: step.id,
      completions: step.usersCompleted,
      retention: previous ? step.usersCompleted / previous : null,
    };
  });

const emptyCounts = (): Record<StepCountBucket, number> => ({
  [StepCountBucket.Live]: 0,
  [StepCountBucket.Planned]: 0,
  [StepCountBucket.Draft]: 0,
  [StepCountBucket.WrappingUp]: 0,
  [StepCountBucket.Done]: 0,
});

const summarize = (params: {
  key: string;
  name: string;
  steps: ProjectStep[];
  withGapFlag: boolean;
  now: Date;
}): CardSummary => {
  const { key, name, withGapFlag, now } = params;
  const steps = [...params.steps].sort(byStepOrder);
  const counts = emptyCounts();
  for (const step of steps) counts[STEP_COUNT_BUCKET[step.status]]++;
  const firstStart = steps[0]?.memberActionStart ?? null;
  const gap = withGapFlag ? gapFlag(steps) : null;
  return {
    key,
    name,
    steps,
    lifecycle: lifecycleOf(steps),
    startedAt: firstStart ? new Date(firstStart) : null,
    counts,
    funnel: funnelOf(steps),
    wontComplete: steps.reduce((sum, step) => sum + step.usersWontComplete, 0),
    dismissed: steps.reduce((sum, step) => sum + step.usersDismissed, 0),
    flags: [
      ...steps.flatMap((step) => stepFlags(step, now)),
      ...(gap ? [gap] : []),
    ],
  };
};

export const byRecentStart = (a: ProjectCard, b: ProjectCard) =>
  (b.startedAt?.getTime() ?? -Infinity) -
    (a.startedAt?.getTime() ?? -Infinity) || a.name.localeCompare(b.name);

export const isProjectStep = (step: ProjectStep) =>
  !step.archived && !step.onboarding;

export const buildProjectCard = (params: {
  project: AdminProjectDto;
  actions: ProjectStep[];
  now: Date;
}): ProjectCard => {
  const { project, actions, now } = params;
  return {
    kind: ProjectCardKind.Project,
    project,
    ...summarize({
      key: `project-${project.id}`,
      name: project.name,
      steps: actions.filter(
        (action) => isProjectStep(action) && action.project?.id === project.id,
      ),
      withGapFlag: true,
      now,
    }),
  };
};

export const buildProjectCards = (params: {
  projects: AdminProjectDto[];
  actions: ProjectStep[];
  now: Date;
}): ProjectCard[] => {
  const { projects, actions, now } = params;
  const projectIds = new Set(projects.map((project) => project.id));
  const standalone = actions.filter(
    (action) =>
      isProjectStep(action) &&
      (!action.project || !projectIds.has(action.project.id)),
  );
  return [
    ...projects.map((project) => buildProjectCard({ project, actions, now })),
    ...standalone.map(
      (action): ProjectCard => ({
        kind: ProjectCardKind.Standalone,
        action,
        ...summarize({
          key: `action-${action.id}`,
          name: action.name,
          steps: [action],
          withGapFlag: false,
          now,
        }),
      }),
    ),
  ].sort(byRecentStart);
};

export const cardsByLifecycle = (
  cards: ProjectCard[],
): Record<ProjectLifecycle, ProjectCard[]> => {
  const sections: Record<ProjectLifecycle, ProjectCard[]> = {
    [ProjectLifecycle.Live]: [],
    [ProjectLifecycle.Upcoming]: [],
    [ProjectLifecycle.InTheWorks]: [],
    [ProjectLifecycle.Awaiting]: [],
    [ProjectLifecycle.Done]: [],
  };
  for (const card of cards) sections[card.lifecycle].push(card);
  return sections;
};
