import type { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import * as activitiesModule from "@alliance/shared/lib/useActivities";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import * as actionTaskPanelModule from "../../components/ActionTaskPanel";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import * as completedBarModule from "./ActionCompletedBarWithInfo";
import LargeActionCard, { type LargeActionCardProps } from "./LargeActionCard";

beforeEach(() => {
  jest.spyOn(activitiesModule, "default").mockReturnValue({
    loading: false,
    activities: [],
    handleLikeActivity: jest.fn(),
    updateActivity: jest.fn(),
    refresh: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  jest.spyOn(completedBarModule, "default").mockImplementation(() => <div />);
  jest
    .spyOn(actionTaskPanelModule, "default")
    .mockImplementation(({ onDeadlinePassed }) => (
      <button onClick={onDeadlinePassed}>Submit late</button>
    ));
});

afterEach(cleanup);

const card = (
  action: ActionWithAwayStatus,
  handlers: Pick<
    LargeActionCardProps,
    "onUpdateActionState" | "onDeadlinePassed"
  > = { onUpdateActionState: () => {}, onDeadlinePassed: () => {} },
) => (
  <MemoryRouter>
    <AuthContext.Provider
      value={authValue({
        user: { ...testAuthUser, hasActiveContract: true },
      })}
    >
      <LargeActionCard
        action={action}
        userRelation="none"
        onCompleteAction={() => {}}
        {...handlers}
      />
    </AuthContext.Provider>
  </MemoryRouter>
);

describe("LargeActionCard deadline refusal", () => {
  it("reports it through onDeadlinePassed, not onUpdateActionState", () => {
    const onDeadlinePassed = jest.fn();
    const onUpdateActionState = jest.fn();

    render(
      card(makeAction({ id: 1, name: "Late task" }), {
        onUpdateActionState,
        onDeadlinePassed,
      }),
    );
    fireEvent.click(screen.getByText("Submit late"));

    expect(onDeadlinePassed).toHaveBeenCalledTimes(1);
    expect(onUpdateActionState).not.toHaveBeenCalled();
  });

  it("gives the next action a fresh task panel", () => {
    jest
      .spyOn(actionTaskPanelModule, "default")
      .mockImplementation(function MountedFor({ action }) {
        const [mountedFor] = useState(action.id);
        return <p data-testid="panel">{`${mountedFor}/${action.id}`}</p>;
      });

    const { rerender } = render(card(makeAction({ id: 7 })));
    rerender(card(makeAction({ id: 8 })));

    expect(screen.getByTestId("panel").textContent).toBe("8/8");
  });
});
