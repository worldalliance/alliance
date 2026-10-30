import { describe, expect, it } from "bun:test";
import { contractViolations } from "./contractViolations";

const schedule = {
  memberActionAt: new Date("2026-11-01T02:00:00Z"),
  officeActionAt: new Date("2026-11-08T07:59:00Z"),
};

describe("contractViolations", () => {
  it("finds none in a 15-minute block over at least 7 days", () => {
    expect(
      contractViolations({
        loads: [{ userId: 1, actionIds: [1], minutes: 15 }],
        schedule,
      }),
    ).toEqual([]);
  });

  it("flags members past 15 minutes and a completion period under 7 days", () => {
    expect(
      contractViolations({
        loads: [
          { userId: 1, actionIds: [1, 2], minutes: 16 },
          { userId: 2, actionIds: [1, 2], minutes: 20 },
          { userId: 3, actionIds: [1], minutes: 10 },
        ],
        schedule: {
          ...schedule,
          officeActionAt: new Date("2026-11-04T02:00:00Z"),
        },
      }),
    ).toEqual([
      "2 members are assigned more than 15 minutes. The contract assigns tasks in 15-minute blocks.",
      "Members get 3 days to finish. The contract promises a 7-day completion period.",
    ]);
  });
});
