import type { ActionEventDto } from "@alliance/shared/client";
import { ActionPhase, actionPhase } from "./actionPhase";

const now = new Date("2026-11-01T00:00:00Z");
const event = (newStatus: ActionEventDto["newStatus"], date: string) =>
  ({
    id: 1,
    title: newStatus,
    description: "",
    newStatus,
    suiteManaged: true,
    date,
  }) satisfies ActionEventDto;

describe("actionPhase", () => {
  it("is Draft or Staff testing before a launch exists", () => {
    expect(actionPhase({ staffPreview: false, events: [] }, now)).toBe(
      ActionPhase.Draft,
    );
    expect(actionPhase({ staffPreview: true, events: [] }, now)).toBe(
      ActionPhase.StaffTesting,
    );
  });

  it("is Scheduled until the launch, even in staff preview", () => {
    const events = [event("member_action", "2026-11-03T02:00:00Z")];
    expect(actionPhase({ staffPreview: true, events }, now)).toBe(
      ActionPhase.Scheduled,
    );
  });

  it("is Live after launch and Closed after the deadline", () => {
    const launched = event("member_action", "2026-10-28T02:00:00Z");
    expect(
      actionPhase(
        {
          staffPreview: false,
          events: [launched, event("office_action", "2026-11-04T06:59:00Z")],
        },
        now,
      ),
    ).toBe(ActionPhase.Live);
    expect(
      actionPhase(
        {
          staffPreview: false,
          events: [launched, event("office_action", "2026-10-31T06:59:00Z")],
        },
        now,
      ),
    ).toBe(ActionPhase.Closed);
  });
});
