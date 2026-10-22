import { isFollowUpFormActiveAt } from "./followUpForm";

describe("isFollowUpFormActiveAt", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("is inactive without a start date", () => {
    expect(isFollowUpFormActiveAt({ startDate: null }, now)).toBe(false);
  });

  it("is inactive before its start date", () => {
    expect(
      isFollowUpFormActiveAt(
        { startDate: new Date("2026-03-11T00:00:00.000Z") },
        now,
      ),
    ).toBe(false);
  });

  it("is active from its start date until its end date", () => {
    const window = { startDate: now, endDate: "2026-03-12T00:00:00.000Z" };
    expect(isFollowUpFormActiveAt(window, now)).toBe(true);
    expect(
      isFollowUpFormActiveAt(window, new Date("2026-03-12T00:00:00.000Z")),
    ).toBe(true);
  });

  it("is inactive after its end date", () => {
    expect(
      isFollowUpFormActiveAt(
        {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: new Date("2026-03-09T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("stays active without an end date", () => {
    expect(
      isFollowUpFormActiveAt({ startDate: "2026-03-01T00:00:00.000Z" }, now),
    ).toBe(true);
  });
});
