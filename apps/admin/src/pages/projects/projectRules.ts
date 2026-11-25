import { formatDistanceToNowStrict, isFuture } from "date-fns";
import { formatDate, formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import {
  COUNT_LABELS,
  type ProjectCard,
  ProjectCardKind,
  type ProjectFlag,
  ProjectFlagKind,
  ProjectLifecycle,
  type ProjectStep,
  StepCountBucket,
} from "../../lib/projectCards";

export const SECTION_TITLES: Record<ProjectLifecycle, string> = {
  [ProjectLifecycle.Live]: "Live",
  [ProjectLifecycle.Upcoming]: "Upcoming",
  [ProjectLifecycle.InTheWorks]: "In the works",
  [ProjectLifecycle.Awaiting]: "Awaiting office or resolution",
  [ProjectLifecycle.Done]: "Done",
};

/** Only Done starts closed: it is the longest section and the least visited. */
export const COLLAPSIBLE: Record<ProjectLifecycle, boolean> = {
  [ProjectLifecycle.Live]: false,
  [ProjectLifecycle.Upcoming]: false,
  [ProjectLifecycle.InTheWorks]: false,
  [ProjectLifecycle.Awaiting]: false,
  [ProjectLifecycle.Done]: true,
};

// Event dates are instants members experience, so they read in the launch zone.
const day = (date: Date | string) =>
  formatDate(date, { timeZone: LAUNCH_TIME_ZONE });

const relative = (date: Date) =>
  formatDistanceToNowStrict(date, { addSuffix: true });

const FLAG_TEXT: Record<ProjectFlagKind, (flag: ProjectFlag) => string> = {
  [ProjectFlagKind.Stuck]: ({ step, at }) =>
    `"${step.name}" has been in its current phase since ${day(at)} with no update posted since`,
  [ProjectFlagKind.NoUpdate]: ({ step, at }) =>
    `"${step.name}" completed ${day(at)} with no update posted`,
  [ProjectFlagKind.DeadlineSoon]: ({ step, at }) =>
    `"${step.name}" closes ${relative(at)}`,
  [ProjectFlagKind.LaunchSoon]: ({ step, at }) =>
    `"${step.name}" opens ${relative(at)}`,
  [ProjectFlagKind.GapBeforeNextStep]: ({ step }) =>
    `Nothing planned after "${step.name}"`,
};

/** The flag in words, and the exact time behind a relative one. */
export const flagText = (flag: ProjectFlag) => ({
  key: `${flag.kind}-${flag.step.id}`,
  text: FLAG_TEXT[flag.kind](flag),
  at: formatDateTime(flag.at, { timeZone: LAUNCH_TIME_ZONE }),
});

export const startedText = (startedAt: Date | null) => {
  if (!startedAt) return "Not started";
  return `${isFuture(startedAt) ? "Starts" : "Started"} ${day(startedAt)}`;
};

/** "1 live · 2 planned": the card's tasks by where they stand, empty ones left out. */
export const countsText = (card: ProjectCard) =>
  Object.values(StepCountBucket)
    .filter((bucket) => card.counts[bucket] > 0)
    .map(
      (bucket) => `${formatCount(card.counts[bucket])} ${COUNT_LABELS[bucket]}`,
    )
    .join(" · ");

export const stepDates = (
  step: Pick<ProjectStep, "memberActionStart" | "memberActionDeadline">,
) => {
  if (!step.memberActionStart) return "Unscheduled";
  const start = day(step.memberActionStart);
  return step.memberActionDeadline
    ? `${start} – ${day(step.memberActionDeadline)}`
    : `From ${start}`;
};

export const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

export const totalCompletions = (card: ProjectCard) =>
  card.funnel.reduce((sum, step) => sum + step.completions, 0);

/** A card matches by its own name or by the name of any of its tasks. */
export const cardMatches = (card: ProjectCard, q: string) => {
  const needle = q.trim().toLowerCase();
  return (
    needle === "" ||
    card.name.toLowerCase().includes(needle) ||
    card.steps.some((step) => step.name.toLowerCase().includes(needle))
  );
};

/** Projects before standalone tasks, each kind keeping the order it came in. */
export const projectsFirst = (cards: ProjectCard[]) => [
  ...cards.filter((card) => card.kind === ProjectCardKind.Project),
  ...cards.filter((card) => card.kind === ProjectCardKind.Standalone),
];
