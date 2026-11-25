import type { ActionEventDto, ActionStatus } from "@alliance/shared/client";
import { phaseLabel } from "../../ui/PhaseBadge";
import { suitePhase } from "./suiteRules";

type SuiteEvent = Pick<ActionEventDto, "id" | "date" | "newStatus">;

export enum EventChange {
  /** Nothing members see changes now. */
  Quiet = "quiet",
  /** Members taking action moves to now or the past: the suite opens at once. */
  Launch = "launch",
  /** The suite's phase changes now. */
  PhaseNow = "phase-now",
  /** A future members start moves earlier. */
  EarlierStart = "earlier-start",
}

export type EventConsequence =
  | { change: EventChange.Quiet }
  | { change: EventChange.Launch }
  | { change: EventChange.PhaseNow; from: ActionStatus; to: ActionStatus }
  | { change: EventChange.EarlierStart; from: string };

/**
 * What saving `date` on one shared event does to members, read as the server
 * reads a task's status: the event in effect now, else Draft.
 */
export function editConsequence(params: {
  event: SuiteEvent;
  date: string;
  events: readonly SuiteEvent[];
  now: Date;
}): EventConsequence {
  const { event, date, events, now } = params;
  const before = new Date(event.date);
  const after = new Date(date);
  if (before.getTime() === after.getTime())
    return { change: EventChange.Quiet };
  const opens = event.newStatus === "member_action";
  if (opens && before > now && after <= now) {
    return { change: EventChange.Launch };
  }
  const from = suitePhase(events, now);
  const to = suitePhase(
    events.map((other) => (other.id === event.id ? { ...other, date } : other)),
    now,
  );
  if (from !== to) return { change: EventChange.PhaseNow, from, to };
  if (opens && after > now && after < before) {
    return { change: EventChange.EarlierStart, from: event.date };
  }
  return { change: EventChange.Quiet };
}

/** The phase the suite is in now, and would be in once `event` is deleted. */
export function deletePhases(params: {
  event: SuiteEvent;
  events: readonly SuiteEvent[];
  now: Date;
}): { from: ActionStatus; to: ActionStatus } {
  const { event, events, now } = params;
  return {
    from: suitePhase(events, now),
    to: suitePhase(
      events.filter((other) => other.id !== event.id),
      now,
    ),
  };
}

/** Says what a phase change does to whether members see the tasks. */
export function phaseChangeText(params: {
  from: ActionStatus;
  to: ActionStatus;
}): string {
  const { from, to } = params;
  const move = `Every task in this suite moves from ${phaseLabel(from)} to ${phaseLabel(to)} now.`;
  if (from === "draft") {
    return `${move} Members the tasks are visible to can see them from now on.`;
  }
  if (to === "draft") {
    return `${move} Members can no longer see a task, unless events of its own keep it out of Draft.`;
  }
  return move;
}
