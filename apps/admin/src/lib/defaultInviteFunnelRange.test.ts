import { defaultInviteFunnelRange } from "./defaultInviteFunnelRange";

describe("defaultInviteFunnelRange", () => {
  it("starts 14 days before the end when now is the last day of a month", () => {
    expect(defaultInviteFunnelRange(new Date("2026-01-31T15:00:00"))).toEqual({
      start: "2026-01-18",
      end: "2026-02-01",
    });
  });

  it("starts 14 days before the end mid-month", () => {
    expect(defaultInviteFunnelRange(new Date("2026-09-11T15:00:00"))).toEqual({
      start: "2026-08-29",
      end: "2026-09-12",
    });
  });
});
