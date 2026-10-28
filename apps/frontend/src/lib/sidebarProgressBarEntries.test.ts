import { makeAction, makeViewer } from "@alliance/shared/lib/testFixtures";
import {
  buildSidebarProgressBarEntries,
  sidebarProgressFormIds,
} from "./sidebarProgressBarEntries";

describe("sidebarProgressFormIds", () => {
  it("follows viewer.assigned past a false shouldParticipate", () => {
    const action = makeAction({
      taskFormId: 7,
      shouldParticipate: false,
    });

    expect(sidebarProgressFormIds([action])).toEqual([7]);
  });

  it("drops an action the viewer is not assigned", () => {
    const action = makeAction({
      taskFormId: 7,
      viewer: makeViewer({ assigned: false }),
    });

    expect(sidebarProgressFormIds([action])).toEqual([]);
  });

  it("drops an action without a task form", () => {
    expect(
      sidebarProgressFormIds([makeAction({ taskFormId: null })]),
    ).toStrictEqual([]);
  });
});

describe("buildSidebarProgressBarEntries", () => {
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
      buildSidebarProgressBarEntries([action], { 7: [progressBar] }),
    ).toEqual([{ action, progressBars: [progressBar] }]);
  });

  it("drops an action whose form resolved no views", () => {
    const action = makeAction({ taskFormId: 7 });

    expect(buildSidebarProgressBarEntries([action], { 7: [] })).toEqual([]);
  });

  it("drops an action the viewer is not assigned", () => {
    const action = makeAction({
      taskFormId: 7,
      viewer: makeViewer({ assigned: false }),
    });

    expect(
      buildSidebarProgressBarEntries([action], { 7: [progressBar] }),
    ).toEqual([]);
  });
});
