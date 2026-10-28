import { describe, expect, it } from "bun:test";
import { otherLiveActions } from "./otherLiveActions";

const schedule = {
  memberActionAt: new Date("2026-11-01T03:00:00Z"),
  officeActionAt: new Date("2026-11-08T07:59:00Z"),
};

const action = (params: {
  id: number;
  start: string | null;
  deadline?: string | null;
  suiteId?: number;
  archived?: boolean;
  onboarding?: boolean;
}) => ({
  id: params.id,
  archived: params.archived ?? false,
  onboarding: params.onboarding ?? false,
  suite: params.suiteId ? { id: params.suiteId, name: "Suite" } : undefined,
  memberActionStart: params.start,
  memberActionDeadline: params.deadline ?? null,
});

describe("otherLiveActions", () => {
  it("keeps actions outside the suite whose window overlaps the launch's", () => {
    const ids = otherLiveActions({
      suiteId: 3,
      schedule,
      actions: [
        action({
          id: 1,
          start: "2026-10-28T00:00:00Z",
          deadline: "2026-11-02T00:00:00Z",
        }),
        action({ id: 2, start: "2026-11-05T00:00:00Z" }),
        action({
          id: 3,
          start: "2026-10-01T00:00:00Z",
          deadline: "2026-10-30T00:00:00Z",
        }),
        action({ id: 4, start: "2026-11-09T00:00:00Z" }),
        action({ id: 5, start: null }),
        action({ id: 6, start: "2026-11-02T00:00:00Z", suiteId: 3 }),
        action({ id: 7, start: "2026-11-02T00:00:00Z", archived: true }),
        action({ id: 8, start: "2026-11-02T00:00:00Z", onboarding: true }),
      ],
    }).map((kept) => kept.id);
    expect(ids).toEqual([1, 2]);
  });
});
