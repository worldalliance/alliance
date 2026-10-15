import type { ActionSuiteDto } from "@alliance/shared/client";
import { suiteOptions } from "./suiteOptions";

const suites: ActionSuiteDto[] = [
  {
    id: 3,
    name: "Spring campaign",
    actions: [],
    events: [],
    reminderGroups: [],
    generalUpdates: [],
  },
];

describe("suiteOptions", () => {
  it("offers no suite followed by each suite", () => {
    expect(suiteOptions({ suites, loading: false, failed: false })).toEqual([
      { value: "", label: "No suite" },
      { value: 3, label: "Spring campaign" },
    ]);
  });

  it("says the suites are loading", () => {
    expect(
      suiteOptions({ suites: [], loading: true, failed: false })[0],
    ).toEqual({ value: "", label: "Loading suites..." });
  });

  it("says the suites failed to load rather than that there are none", () => {
    expect(suiteOptions({ suites: [], loading: false, failed: true })).toEqual([
      { value: "", label: "Failed to load suites" },
    ]);
  });
});
