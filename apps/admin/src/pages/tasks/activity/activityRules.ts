import type {
  ActionEventDto,
  ActionStatus,
  ActionUpdateDto,
  CohortDecisionReason,
} from "@alliance/shared/client";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";

export const REASON_LABELS: Record<CohortDecisionReason, string> = {
  launch: "At launch",
  signing: "On signing",
  resolved_after_deadline: "Resolved after deadline",
  backfill: "Backfill",
  staff_correction: "Staff correction",
  prerequisites_resolved: "After prerequisites",
};

export const decisionLabel = (included: boolean) =>
  included ? "Assigned" : "Excluded";

export enum HistoryKind {
  Phase = "phase",
  Published = "published",
  Notified = "notified",
}

export type HistoryRow = {
  key: string;
  kind: HistoryKind;
  at: string;
  /** In the future: it hasn't happened yet. */
  scheduled: boolean;
  /** The phase for a phase start, the update's title otherwise. */
  status?: ActionStatus;
  title?: string;
};

/**
 * What the task's events and updates say happened to it, newest first. A
 * draft update has no time and is left out, as is an update never notified.
 */
export const historyRows = (params: {
  events: readonly ActionEventDto[];
  updates: readonly ActionUpdateDto[];
  now: Date;
}): HistoryRow[] => {
  const { events, updates, now } = params;
  const rows: HistoryRow[] = [
    ...events.map(
      (event): HistoryRow => ({
        key: `event-${event.id}`,
        kind: HistoryKind.Phase,
        at: event.date,
        scheduled: new Date(event.date) > now,
        status: event.newStatus,
      }),
    ),
    ...updates.flatMap((update): HistoryRow[] => [
      ...(update.visibleAt
        ? [
            {
              key: `published-${update.id}`,
              kind: HistoryKind.Published,
              at: update.visibleAt,
              scheduled: new Date(update.visibleAt) > now,
              title: update.title,
            },
          ]
        : []),
      ...(update.notifiedAt
        ? [
            {
              key: `notified-${update.id}`,
              kind: HistoryKind.Notified,
              at: update.notifiedAt,
              scheduled: false,
              title: update.title,
            },
          ]
        : []),
    ]),
  ];
  return rows.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
};

/**
 * Why the decisions list is empty. Decisions exist only from the task's
 * member action start, and never for an open-by-link task
 * (`readsSavedDecisions`, server/src/actions/cohort-decision.ts); the
 * resolver pass runs every five minutes and on signing
 * (`cohort-decision.worker.ts`, `cohort-decision.listener.ts`).
 */
export const noDecisionsReason = (
  task: Pick<ParsedActionDto, "publicOnly" | "events">,
  now: Date,
): string => {
  if (task.publicOnly) {
    return "This task is open by link only, so it keeps no cohort decisions.";
  }
  const started = task.events.some(
    (event) =>
      event.newStatus === "member_action" && new Date(event.date) <= now,
  );
  return started
    ? "Members' action has started, but no member has been decided yet. Decisions are recorded every few minutes for members who can be assigned, and when a member signs."
    : "Decisions are recorded from the moment members' action starts, so there are none while the task is a draft or before that.";
};
