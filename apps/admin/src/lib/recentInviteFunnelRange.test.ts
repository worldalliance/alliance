import { recentInviteFunnelRange } from "./recentInviteFunnelRange";

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
afterEach(() => {
  process.env.TZ = hostZone;
});

describe("recentInviteFunnelRange", () => {
  it("starts 14 days before the end when now is the last day of a month", () => {
    expect(
      recentInviteFunnelRange(new Date("2026-01-31T15:00:00"), 14),
    ).toEqual({
      start: "2026-01-18",
      end: "2026-02-01",
    });
  });

  it("starts 14 days before the end mid-month", () => {
    expect(
      recentInviteFunnelRange(new Date("2026-09-11T15:00:00"), 14),
    ).toEqual({
      start: "2026-08-29",
      end: "2026-09-12",
    });
  });

  it("ends tomorrow so today's invites fall inside the server's range", () => {
    expect(recentInviteFunnelRange(new Date("2026-09-11T15:00:00"), 7)).toEqual(
      {
        start: "2026-09-05",
        end: "2026-09-12",
      },
    );
  });

  it("ends tomorrow in the first hour of a fall-back day", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(recentInviteFunnelRange(new Date("2026-11-01T00:30:00"), 7)).toEqual(
      {
        start: "2026-10-26",
        end: "2026-11-02",
      },
    );
  });
});
