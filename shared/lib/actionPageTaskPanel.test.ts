import type { ActionDto } from "../client/types.gen";
import {
  ActionPageTaskPanelState,
  getActionPageTaskPanelState,
} from "./actionPageTaskPanel";
import {
  makeAction,
  makeEvent,
  makeLegacyAction,
  makeViewer,
} from "./testFixtures";

type StateParams = Parameters<typeof getActionPageTaskPanelState>[0];

function stateOf(
  action: ActionDto,
  overrides: Partial<Omit<StateParams, "action">> = {},
): ActionPageTaskPanelState {
  return getActionPageTaskPanelState({
    action,
    contractSigned: true,
    isAuthenticated: true,
    hasRefCode: false,
    hasGuestResponse: false,
    ...overrides,
  });
}

describe("getActionPageTaskPanelState", () => {
  it("resolves the auth/guest states before touching per-user status", () => {
    const action = makeAction({ viewer: undefined });
    expect(
      stateOf(action, { isAuthenticated: false, hasGuestResponse: true }),
    ).toBe(ActionPageTaskPanelState.GuestCompleted);
    expect(stateOf(makeAction({ publicOnly: true }))).toBe(
      ActionPageTaskPanelState.PublicOnlyAuthenticated,
    );
    expect(
      stateOf(makeAction({ publicOnly: true }), { isAuthenticated: false }),
    ).toBe(ActionPageTaskPanelState.PublicOnly);
    const guestVisible = makeAction({ reqAuthenticated: false });
    expect(stateOf(guestVisible, { isAuthenticated: false })).toBe(
      ActionPageTaskPanelState.NotAuthenticated,
    );
    expect(
      stateOf(guestVisible, { isAuthenticated: false, hasRefCode: true }),
    ).toBe(ActionPageTaskPanelState.GuestRef);
  });

  it("shows the task for a plain assigned todo on both paths", () => {
    expect(stateOf(makeAction())).toBe(ActionPageTaskPanelState.ShowTask);
    expect(stateOf(makeLegacyAction())).toBe(ActionPageTaskPanelState.ShowTask);
  });

  it("maps cannot-complete to NotAssigned unless completion is prevented", () => {
    expect(
      stateOf(makeAction({ viewer: makeViewer({ canComplete: false }) })),
    ).toBe(ActionPageTaskPanelState.NotAssigned);
    expect(stateOf(makeLegacyAction({ canParticipate: false }))).toBe(
      ActionPageTaskPanelState.NotAssigned,
    );
    // preventCompletion falls through to MemberActionClosed instead.
    expect(
      stateOf(
        makeAction({
          preventCompletion: true,
          viewer: makeViewer({ canComplete: false }),
        }),
      ),
    ).toBe(ActionPageTaskPanelState.MemberActionClosed);
  });

  it("locks onboarding actions until the contract is signed", () => {
    const onboarding = makeAction({ onboarding: true });
    expect(stateOf(onboarding, { contractSigned: false })).toBe(
      ActionPageTaskPanelState.OnboardingSignContractFirst,
    );
    expect(stateOf(onboarding, { contractSigned: true })).toBe(
      ActionPageTaskPanelState.ShowTask,
    );
    expect(
      stateOf(makeAction({ onboarding: true, isContractSigningAction: true }), {
        contractSigned: false,
      }),
    ).toBe(ActionPageTaskPanelState.ShowTask);
  });

  it("maps terminal relations on both paths", () => {
    expect(
      stateOf(makeAction({ viewer: makeViewer({ relation: "completed" }) })),
    ).toBe(ActionPageTaskPanelState.Completed);
    expect(
      stateOf(makeAction({ viewer: makeViewer({ relation: "withdrawn" }) })),
    ).toBe(ActionPageTaskPanelState.Declined);
    expect(stateOf(makeLegacyAction({ userRelation: "completed" }))).toBe(
      ActionPageTaskPanelState.Completed,
    );
    expect(stateOf(makeLegacyAction({ userRelation: "declined" }))).toBe(
      ActionPageTaskPanelState.Declined,
    );
  });

  it("renders a dismissed action exactly like an undismissed one", () => {
    expect(
      stateOf(makeAction({ viewer: makeViewer({ dismissed: true }) })),
    ).toBe(ActionPageTaskPanelState.ShowTask);
    // Legacy servers report dismissal as a userRelation value.
    expect(stateOf(makeLegacyAction({ userRelation: "dismissed" }))).toBe(
      ActionPageTaskPanelState.ShowTask,
    );
  });

  it("treats a missing per-user payload as MissingDataOrNotActive", () => {
    expect(stateOf(makeLegacyAction({ userRelation: undefined }))).toBe(
      ActionPageTaskPanelState.MissingDataOrNotActive,
    );
  });

  it("shows the missed-deadline task once the phase closed, on both paths", () => {
    expect(
      stateOf(
        makeAction({
          status: "resolution",
          viewer: makeViewer({ memberActionStarted: true }),
        }),
      ),
    ).toBe(ActionPageTaskPanelState.ShowTaskWithMissedDeadline);
    expect(
      stateOf(
        makeLegacyAction({
          status: "resolution",
          events: [makeEvent()],
        }),
      ),
    ).toBe(ActionPageTaskPanelState.ShowTaskWithMissedDeadline);
  });

  it("marks optional actions", () => {
    expect(stateOf(makeAction({ optional: true }))).toBe(
      ActionPageTaskPanelState.Optional,
    );
  });
});
