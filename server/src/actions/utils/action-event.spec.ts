import { memberActionPhase } from "@alliance/common/actionEvent";
import { ActionEvent, ActionStatus } from "../entities/action-event.entity";
import { shortensMemberActionDeadline } from "./action-event";

function event(id: number, date: string, newStatus: ActionStatus): ActionEvent {
  return { id, date: new Date(date), newStatus } as ActionEvent;
}

describe("shortensMemberActionDeadline", () => {
  const start = event(1, "2026-02-01", ActionStatus.MemberAction);
  const phase = (deadline: string | null) =>
    memberActionPhase(
      deadline ? [start, event(2, deadline, ActionStatus.Resolution)] : [start],
    );

  it("is true when the deadline moves earlier", () => {
    expect(
      shortensMemberActionDeadline(phase("2026-03-01"), phase("2026-02-15")),
    ).toBe(true);
  });

  it("is false when the deadline moves later or stays", () => {
    expect(
      shortensMemberActionDeadline(phase("2026-03-01"), phase("2026-04-01")),
    ).toBe(false);
    expect(
      shortensMemberActionDeadline(phase("2026-03-01"), phase("2026-03-01")),
    ).toBe(false);
  });

  it("is true when a phase without a deadline gets one", () => {
    expect(shortensMemberActionDeadline(phase(null), phase("2026-03-01"))).toBe(
      true,
    );
  });

  it("is false when the deadline is removed", () => {
    expect(shortensMemberActionDeadline(phase("2026-03-01"), phase(null))).toBe(
      false,
    );
  });
});
