import { makeAction, makeViewer } from "@alliance/shared/lib/testFixtures";
import {
  sidebarProgressActionCandidates,
  sidebarProgressBarActions,
} from "./fetchTaskFormProgressViews";

describe("sidebarProgressActionCandidates", () => {
  it("follows viewer.assigned past a false shouldParticipate", () => {
    const action = makeAction({
      taskFormId: 7,
      shouldParticipate: false,
    });

    expect(sidebarProgressActionCandidates([action])).toEqual([
      { actionId: action.id, formId: 7 },
    ]);
  });

  it("drops an action the viewer is not assigned", () => {
    const action = makeAction({
      taskFormId: 7,
      viewer: makeViewer({ assigned: false }),
    });

    expect(sidebarProgressActionCandidates([action])).toEqual([]);
  });
});

describe("sidebarProgressBarActions", () => {
  const progressBar = {
    kind: "progressbar",
    id: "bar",
    title: "",
    caption: "",
    numerator: { type: "number", value: 1 },
    denominator: { type: "number", value: 2 },
    displayType: "number",
  } as const;

  it("pairs an action with the progress bars its form resolved", () => {
    const action = makeAction({ taskFormId: 7 });

    expect(
      sidebarProgressBarActions([action], { [action.id]: [progressBar] }),
    ).toEqual([{ action, progressBars: [progressBar] }]);
  });

  it("drops an action whose form resolved no views", () => {
    const action = makeAction({ taskFormId: 7 });

    expect(sidebarProgressBarActions([action], { [action.id]: [] })).toEqual(
      [],
    );
  });

  it("drops an action the viewer is not assigned", () => {
    const action = makeAction({
      taskFormId: 7,
      viewer: makeViewer({ assigned: false }),
    });

    expect(
      sidebarProgressBarActions([action], { [action.id]: [progressBar] }),
    ).toEqual([]);
  });

  it("drops a formless action carrying a stale view entry", () => {
    const action = makeAction({ taskFormId: undefined });

    expect(
      sidebarProgressBarActions([action], { [action.id]: [progressBar] }),
    ).toEqual([]);
  });
});
