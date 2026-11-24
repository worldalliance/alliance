import { describe, expect, it } from "bun:test";
import {
  actionTimeUp,
  creditedSeconds,
  KORA_ACTION_ACTIVE_SECONDS,
  KORA_ACTIVE_REPORT_MAX_SECONDS,
} from "./kora-active-time";

const now = new Date("2026-11-23T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("creditedSeconds", () => {
  it("credits a report within the time since the last one", () => {
    expect(
      creditedSeconds({ reported: 30, now, lastReportedAt: ago(31) }),
    ).toBe(30);
  });

  it("caps a report at the time since the last one", () => {
    expect(creditedSeconds({ reported: 30, now, lastReportedAt: ago(5) })).toBe(
      5,
    );
  });

  it("caps a first report at the per-report maximum", () => {
    expect(creditedSeconds({ reported: 500, now, lastReportedAt: null })).toBe(
      KORA_ACTIVE_REPORT_MAX_SECONDS,
    );
  });

  it("credits nothing for a last report in the future", () => {
    expect(
      creditedSeconds({ reported: 30, now, lastReportedAt: ago(-10) }),
    ).toBe(0);
  });
});

describe("actionTimeUp", () => {
  it("is up only for an action's assignment at the limit", () => {
    const full = { activeSeconds: KORA_ACTION_ACTIVE_SECONDS };
    expect(actionTimeUp({ ...full, actionId: 1 })).toBe(true);
    expect(actionTimeUp({ ...full, actionId: null })).toBe(false);
    expect(actionTimeUp({ actionId: 1, activeSeconds: 899 })).toBe(false);
  });
});
