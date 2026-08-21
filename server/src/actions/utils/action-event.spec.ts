import { ActionEvent, ActionStatus } from "../entities/action-event.entity";
import { memberActionPhase } from "./action-event";

function event(id: number, date: string, newStatus: ActionStatus): ActionEvent {
  return { id, date: new Date(date), newStatus } as ActionEvent;
}

describe("memberActionPhase", () => {
  it("returns nulls when there is no member-action event", () => {
    const events = [
      event(1, "2026-01-01", ActionStatus.Planned),
      event(2, "2026-02-01", ActionStatus.OfficeAction),
    ];
    expect(memberActionPhase(events)).toEqual({
      event: null,
      deadlineEvent: null,
    });
  });

  it("returns the member-action event and the first event after it", () => {
    const memberAction = event(2, "2026-02-01", ActionStatus.MemberAction);
    const resolution = event(3, "2026-03-01", ActionStatus.Resolution);
    const events = [
      event(1, "2026-01-01", ActionStatus.Planned),
      memberAction,
      resolution,
      event(4, "2026-04-01", ActionStatus.Completed),
    ];
    expect(memberActionPhase(events)).toEqual({
      event: memberAction,
      deadlineEvent: resolution,
    });
  });

  it("returns a null deadline when the member-action event is the last event", () => {
    const memberAction = event(2, "2026-02-01", ActionStatus.MemberAction);
    const events = [event(1, "2026-01-01", ActionStatus.Planned), memberAction];
    expect(memberActionPhase(events)).toEqual({
      event: memberAction,
      deadlineEvent: null,
    });
  });

  it("ignores event order in the input array", () => {
    const memberAction = event(2, "2026-02-01", ActionStatus.MemberAction);
    const resolution = event(3, "2026-03-01", ActionStatus.Resolution);
    const events = [resolution, memberAction];
    expect(memberActionPhase(events)).toEqual({
      event: memberAction,
      deadlineEvent: resolution,
    });
  });
});
