import { taskHeaders } from "./copy";
import { getTaskDismissInfo } from "./largeActionCard";
import { makeAction, makeViewer } from "./testFixtures";

describe("getTaskDismissInfo", () => {
  it("returns nothing for a plain required task or an onboarding task", () => {
    expect(getTaskDismissInfo(makeAction())).toBeUndefined();
    expect(
      getTaskDismissInfo(makeAction({ onboarding: true, optional: true })),
    ).toBeUndefined();
  });

  it("shows the away banner from viewer.away, picking the phase-specific copy", () => {
    const currently = getTaskDismissInfo(
      makeAction({ viewer: makeViewer({ away: "away_currently" }) }),
    );
    expect(currently?.header).toBe(taskHeaders.homePage.away.title);
    expect(currently?.message).toBe(
      taskHeaders.homePage.away.description.currentlyAway,
    );
    const later = getTaskDismissInfo(
      makeAction({ viewer: makeViewer({ away: "away_later" }) }),
    );
    expect(later?.message).toBe(
      taskHeaders.homePage.away.description.willBeAway,
    );
  });

  it("falls back to the legacy awayStatus field without viewer", () => {
    const info = getTaskDismissInfo(
      makeAction({ viewer: undefined, awayStatus: "away_previously" }),
    );
    expect(info?.header).toBe(taskHeaders.homePage.away.title);
    expect(info?.message).toBe(taskHeaders.homePage.away.description.wasAway);
  });

  it("prefers viewer.away over a stale flat field", () => {
    const info = getTaskDismissInfo(
      makeAction({
        awayStatus: "away_currently",
        viewer: makeViewer({ away: "not_away" }),
      }),
    );
    expect(info).toBeUndefined();
  });

  it("shows the deadline banner once the phase closed, then optional copy", () => {
    const missed = getTaskDismissInfo(makeAction({ status: "resolution" }));
    expect(missed?.header).toBe(taskHeaders.homePage.deadline.title);
    const optional = getTaskDismissInfo(makeAction({ optional: true }));
    expect(optional?.header).toBe(taskHeaders.homePage.optional.title);
  });
});
