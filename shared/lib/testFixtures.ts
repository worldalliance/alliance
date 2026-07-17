import type { ActionEventDto, UserActionStatusDto } from "../client/types.gen";
import type { ActionWithAwayStatus } from "./actionUtils";

// Test-only fixture builders shared by the shared/lib suites. The defaults
// describe a plain assigned todo in the member-action phase, expressed
// through the server-computed `viewer` status; `makeLegacyAction` re-expresses
// the same action through the legacy flat fields (no `viewer`) for the
// fallback paths.

export function makeViewer(
  overrides: Partial<UserActionStatusDto> = {},
): UserActionStatusDto {
  return {
    assigned: true,
    canComplete: true,
    relation: "none",
    dismissed: false,
    away: "not_away",
    memberActionStarted: true,
    deadlineAt: null,
    deadlinePassed: false,
    display: "todo",
    ...overrides,
  };
}

export function makeAction(
  overrides: Partial<ActionWithAwayStatus> = {},
): ActionWithAwayStatus {
  return {
    id: 1,
    name: "Test action",
    category: "test",
    body: "",
    shortDescription: "",
    type: "Activity",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    isContractSigningAction: false,
    visibilityMode: "all_members",
    usersJoined: 0,
    usersCompleted: 0,
    priority: 0,
    optional: false,
    preventCompletion: false,
    isForumParticipationAction: false,
    archived: false,
    followUpForms: [],
    updates: [],
    status: "member_action",
    publicOnly: false,
    reqAuthenticated: true,
    canParticipate: true,
    onboarding: false,
    shouldCompleteAfterDeadline: false,
    awayStatus: "not_away",
    events: [],
    viewer: makeViewer(),
    ...overrides,
  };
}

export function makeEvent(
  overrides: Partial<ActionEventDto> = {},
): ActionEventDto {
  return {
    id: 1,
    title: "",
    description: "",
    newStatus: "member_action",
    date: new Date(Date.now() - 1000).toISOString(),
    suiteManaged: false,
    ...overrides,
  };
}

/** The same action expressed through the legacy flat fields, no `viewer`. */
export function makeLegacyAction(
  overrides: Partial<ActionWithAwayStatus> = {},
): ActionWithAwayStatus {
  return makeAction({
    viewer: undefined,
    shouldParticipate: true,
    userRelation: "none",
    events: [makeEvent()],
    ...overrides,
  });
}
