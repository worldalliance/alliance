import { describe, expect, it } from "bun:test";
import { PhaseRole, phaseStrip } from "./suitePhaseStrip";

const now = new Date("2026-11-25T12:00:00Z");
const start = {
  id: 1,
  newStatus: "member_action" as const,
  date: "2026-11-20T03:00:00Z",
};
const deadline = {
  id: 2,
  newStatus: "office_action" as const,
  date: "2026-11-27T07:59:00Z",
};

describe("phaseStrip", () => {
  it("marks the shared event in effect and names start and deadline", () => {
    expect(
      phaseStrip({ events: [deadline, start], now, canLaunch: false }),
    ).toEqual([
      { key: "draft", status: "draft", date: null, role: null, now: false },
      {
        key: "1",
        status: "member_action",
        date: start.date,
        role: PhaseRole.MembersStart,
        now: true,
      },
      {
        key: "2",
        status: "office_action",
        date: deadline.date,
        role: PhaseRole.Deadline,
        now: false,
      },
    ]);
  });

  it("shows the two events launch creates on a suite that can launch", () => {
    const cells = phaseStrip({ events: [], now, canLaunch: true });
    expect(cells.map((cell) => [cell.status, cell.date, cell.now])).toEqual([
      ["draft", null, true],
      ["member_action", null, false],
      ["office_action", null, false],
    ]);
  });

  it("adds the events launch creates after a launchable suite's own", () => {
    const completed = {
      id: 3,
      newStatus: "completed" as const,
      date: "2026-12-20T03:00:00Z",
    };
    expect(
      phaseStrip({ events: [completed], now, canLaunch: true }).map(
        (cell) => cell.key,
      ),
    ).toEqual(["draft", "3", "launch-start", "launch-deadline"]);
  });

  it("shows Draft alone where launch is refused", () => {
    expect(
      phaseStrip({ events: [], now, canLaunch: false }).map((c) => c.key),
    ).toEqual(["draft"]);
  });
});
