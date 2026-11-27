import {
  eventInEffectAt,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import type { ActionEventDto, ActionStatus } from "@alliance/shared/client";

type SuiteEvent = Pick<ActionEventDto, "id" | "date" | "newStatus">;

export enum PhaseRole {
  MembersStart = "members-start",
  Deadline = "deadline",
}

export type PhaseCell = {
  key: string;
  status: ActionStatus;
  /** Null for Draft, and for an event launch will create. */
  date: string | null;
  role: PhaseRole | null;
  now: boolean;
};

const LAUNCH_CELLS: PhaseCell[] = [
  {
    key: "launch-start",
    status: "member_action",
    date: null,
    role: PhaseRole.MembersStart,
    now: false,
  },
  {
    key: "launch-deadline",
    status: "office_action",
    date: null,
    role: PhaseRole.Deadline,
    now: false,
  },
];

/**
 * The suite's phases in order: Draft, then one per shared event, then for a
 * suite that can launch the two events launch creates.
 */
export function phaseStrip(params: {
  events: readonly SuiteEvent[];
  now: Date;
  canLaunch: boolean;
}): PhaseCell[] {
  const { events, now, canLaunch } = params;
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const inEffect = eventInEffectAt([...sorted], now).event;
  const { event: start, deadlineEvent } = memberActionPhase([...sorted]);
  const draft: PhaseCell = {
    key: "draft",
    status: "draft",
    date: null,
    role: null,
    now: inEffect === null,
  };
  return [
    draft,
    ...sorted.map(
      (event): PhaseCell => ({
        key: String(event.id),
        status: event.newStatus,
        date: event.date,
        role:
          event.id === start?.id
            ? PhaseRole.MembersStart
            : event.id === deadlineEvent?.id
              ? PhaseRole.Deadline
              : null,
        now: event.id === inEffect?.id,
      }),
    ),
    ...(canLaunch ? LAUNCH_CELLS : []),
  ];
}
