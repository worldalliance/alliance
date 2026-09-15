import { taskHeaders } from "./copy";
import { getTaskDismissInfo } from "./largeActionCard";
import {
  makeAction,
  makeViewer,
  makeViewerWithUnknownOptionalReason,
} from "./testFixtures";

describe("getTaskDismissInfo", () => {
  it("returns nothing for a plain required task or an onboarding task", () => {
    expect(getTaskDismissInfo(makeAction())).toBeUndefined();
    expect(
      getTaskDismissInfo(makeAction({ onboarding: true, optional: true })),
    ).toBeUndefined();
  });

  it("offers no dismissal for a staff preview", () => {
    expect(
      getTaskDismissInfo(
        makeAction({
          optional: true,
          viewer: makeViewer({ staffPreview: true }),
        }),
      ),
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

  it("shows the deadline banner for a required task and optional copy for an optional one", () => {
    const missed = getTaskDismissInfo(makeAction({ status: "resolution" }));
    expect(missed?.header).toBe(taskHeaders.homePage.deadline.title);
    const optional = getTaskDismissInfo(makeAction({ optional: true }));
    expect(optional?.header).toBe(taskHeaders.homePage.optional.title);
  });

  it("keeps the optional banner once the deadline has passed", () => {
    const info = getTaskDismissInfo(
      makeAction({ optional: true, status: "resolution" }),
    );
    expect(info?.header).toBe(taskHeaders.homePage.optional.title);
  });

  it("says optional for you where only the viewer's flag is set", () => {
    const info = getTaskDismissInfo(
      makeAction({ optional: false, viewer: makeViewer({ optional: true }) }),
    );
    expect(info?.header).toBe(taskHeaders.homePage.optionalForViewer.title);
    expect(info?.message).toBe(
      taskHeaders.homePage.optionalForViewer.description,
    );
  });

  it("says optional for you without a reason this build doesn't know", () => {
    const info = getTaskDismissInfo(
      makeAction({
        optional: false,
        viewer: makeViewerWithUnknownOptionalReason(),
      }),
    );
    expect(info?.header).toBe(taskHeaders.homePage.optionalForViewer.title);
    expect(info?.message).toBe(
      taskHeaders.homePage.optionalForViewer.description,
    );
  });

  it("names the contract gap when the server gives it as the reason", () => {
    const info = getTaskDismissInfo(
      makeAction({
        optional: false,
        viewer: makeViewer({ optional: true, optionalReason: "contract_gap" }),
      }),
    );
    expect(info?.header).toBe(
      taskHeaders.homePage.optionalForContractGap.title,
    );
    expect(info?.message).toBe(
      taskHeaders.homePage.optionalForContractGap.description,
    );
  });

  it("keeps that wording once the deadline has passed", () => {
    const info = getTaskDismissInfo(
      makeAction({
        optional: false,
        status: "resolution",
        viewer: makeViewer({ optional: true, optionalReason: "contract_gap" }),
      }),
    );
    expect(info?.header).toBe(
      taskHeaders.homePage.optionalForContractGap.title,
    );
    expect(info?.message).toBe(
      taskHeaders.homePage.optionalForContractGap.description,
    );
  });
});
