import { eventInEffectAt } from "@alliance/common/actionEvent";
import { R, type Result } from "@alliance/common/result";
import type { ActionStatus, VisibilityMode } from "@alliance/shared/client";
import { z } from "zod";

const ACTION_STATUSES: Record<ActionStatus, true> = {
  draft: true,
  planned: true,
  member_action: true,
  office_action: true,
  resolution: true,
  completed: true,
  failed: true,
  abandoned: true,
};
const VISIBILITY_MODES: Record<VisibilityMode, true> = {
  public: true,
  all_members: true,
  participating_groups: true,
};

const isKey = <K extends string>(
  record: Record<K, true>,
  value: unknown,
): value is K => typeof value === "string" && Object.hasOwn(record, value);

const pastedEventSchema = z.looseObject({
  newStatus: z.custom<ActionStatus>((value) => isKey(ACTION_STATUSES, value)),
  date: z.iso.datetime({ offset: true }),
});

// The fields of an export (`ExportActionDto`) that decide what a paste creates;
// the rest pass through to the server untouched.
const pastedTaskSchema = z.looseObject({
  name: z.string().trim().min(1),
  body: z.string(),
  archived: z.boolean().optional(),
  staffPreview: z.boolean().optional(),
  publicOnly: z.boolean().optional(),
  visibilityMode: z
    .custom<VisibilityMode>((value) => isKey(VISIBILITY_MODES, value))
    .optional(),
  suite: z.looseObject({ name: z.string() }).nullish(),
  taskForm: z.unknown().optional(),
  events: z.array(pastedEventSchema).nullish(),
});

export type PastedTask = z.infer<typeof pastedTaskSchema>;
export type PastedEvent = z.infer<typeof pastedEventSchema>;

export const NOT_JSON = "Paste the JSON a task's Export JSON copied";
export const NOT_A_TASK =
  "This JSON isn't a task export: it needs a name and a body, and any events need a status and a date";

export function parsePastedTask(text: string): Result<PastedTask, string> {
  if (text.trim() === "") return R.failure(NOT_JSON);
  const json = R.fromThrowable(
    (): unknown => JSON.parse(text),
    () => NOT_JSON,
  );
  if (!json.ok) return json;
  const parsed = pastedTaskSchema.safeParse(json.value);
  return parsed.success ? R.success(parsed.data) : R.failure(NOT_A_TASK);
}

/** The request body: the export as pasted, less its events unless staff include them. */
export function pasteBody(
  task: PastedTask,
  { includeEvents }: { includeEvents: boolean },
): string {
  if (includeEvents) return JSON.stringify(task);
  const { events: _events, ...withoutEvents } = task;
  return JSON.stringify(withoutEvents);
}

export enum EventsOutcomeKind {
  Live = "live",
  Scheduled = "scheduled",
  StaysDraft = "staysDraft",
}

export type EventsOutcome =
  | { kind: EventsOutcomeKind.Live; event: PastedEvent }
  | { kind: EventsOutcomeKind.Scheduled; event: PastedEvent }
  | { kind: EventsOutcomeKind.StaysDraft };

/** What the server makes of the events: the status is the latest event dated at or before now, Draft with none. */
export function eventsOutcome(
  events: readonly PastedEvent[],
  now: Date,
): EventsOutcome {
  const inEffect = eventInEffectAt([...events], now).event;
  if (inEffect && inEffect.newStatus !== "draft") {
    return { kind: EventsOutcomeKind.Live, event: inEffect };
  }
  const next = events
    .filter(
      (event) => event.newStatus !== "draft" && new Date(event.date) > now,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  return next
    ? { kind: EventsOutcomeKind.Scheduled, event: next }
    : { kind: EventsOutcomeKind.StaysDraft };
}

export const AUDIENCE: Record<VisibilityMode, string> = {
  public: "anyone, signed in or not",
  all_members: "every signed-in member",
  participating_groups: "the members in its cohort",
};
