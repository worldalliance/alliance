import { cleanup, render, screen } from "@testing-library/react";
import OpenReferenceWarning from "./OpenReferenceWarning";

afterEach(cleanup);

const LAUNCH = new Date("2026-01-10T00:00:00Z");
const OPEN = new Date("2026-01-12T00:00:00Z");
const DEADLINE = new Date("2026-01-20T00:00:00Z");

const renderWarning = (
  actions: {
    id: number;
    name: string;
    deadline: Date | null;
    onboarding?: boolean;
  }[],
  schedule: { start: Date | null; deadline: Date | null } = {
    start: LAUNCH,
    deadline: DEADLINE,
  },
) =>
  render(
    <OpenReferenceWarning
      actionId={99}
      expression={{
        type: "OR",
        children: actions.map((action) => ({
          type: "CompletedAction" as const,
          actionId: action.id,
        })),
      }}
      prerequisiteActionIds={[]}
      memberActionStart={schedule.start}
      memberActionDeadline={schedule.deadline}
      actions={actions.map((action) => ({
        onboarding: false,
        ...action,
        formIds: [],
      }))}
    />,
  );

describe("OpenReferenceWarning", () => {
  it("suggests one prerequisite for one open action", () => {
    renderWarning([{ id: 1, name: "Call", deadline: OPEN }]);

    expect(screen.getByText(/Add it as a prerequisite/)).toBeDefined();
  });

  it("suggests prerequisites for several open actions", () => {
    renderWarning([
      { id: 1, name: "Call", deadline: OPEN },
      { id: 2, name: "Write", deadline: OPEN },
    ]);

    expect(screen.getByText(/Add them as prerequisites/)).toBeDefined();
  });

  it("says when members are decided at a scheduled launch", () => {
    renderWarning([{ id: 1, name: "Call", deadline: OPEN }]);

    expect(screen.getByText(/decided at launch/)).toBeDefined();
  });

  it("doesn't claim a launch time before one is scheduled", () => {
    renderWarning(
      [{ id: 1, name: "Call", deadline: new Date(Date.now() + 86_400_000) }],
      { start: null, deadline: null },
    );

    expect(
      screen.getByText(
        /launches before it closes, a member who finishes it later/,
      ),
    ).toBeDefined();
    expect(screen.queryByText(/decided at launch/)).toBeNull();
  });

  it("doesn't suggest a prerequisite that closes no earlier than this action", () => {
    renderWarning([{ id: 1, name: "Call", deadline: DEADLINE }]);

    expect(
      screen.getByText(/closes no earlier than this action or has no deadline/),
    ).toBeDefined();
    expect(screen.queryByText(/Add it as a prerequisite/)).toBeNull();
  });

  it("doesn't suggest a prerequisite on an onboarding action", () => {
    renderWarning([
      { id: 1, name: "Welcome", deadline: OPEN, onboarding: true },
    ]);

    expect(
      screen.getByText(/an onboarding action that stays open/),
    ).toBeDefined();
    expect(screen.queryByText(/Add it as a prerequisite/)).toBeNull();
    expect(screen.queryByText(/closes no earlier/)).toBeNull();
  });

  it("asks for a deadline instead when the action has none", () => {
    renderWarning([{ id: 1, name: "Call", deadline: null }]);

    expect(
      screen.getByText(/closes no earlier than this action or has no deadline/),
    ).toBeDefined();
    expect(screen.queryByText(/Add it as a prerequisite/)).toBeNull();
  });
});
