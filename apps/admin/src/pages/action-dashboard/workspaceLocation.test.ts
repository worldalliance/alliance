import { ActionEditorSection } from "../../lib/staffTestingGate";
import {
  actionSectionPath,
  legacyTabRedirect,
  moveToTab,
  projectActionRedirect,
  WorkspaceTab,
} from "./workspaceLocation";

describe("legacyTabRedirect", () => {
  it("keeps the other params and the hash when the new place names none", () => {
    expect(
      legacyTabRedirect({ search: "?tab=details&field=body", hash: "#x" }),
    ).toBe("?tab=content&field=body#x");
  });

  it("leaves current tabs and unknown values alone", () => {
    for (const tab of ["overview", "responses", "constructor", ""]) {
      expect(legacyTabRedirect({ search: `?tab=${tab}`, hash: "" })).toBe(null);
    }
  });
});

describe("actionSectionPath", () => {
  it.each([
    [ActionEditorSection.Release, "/actions/4?tab=overview#release"],
    [ActionEditorSection.Details, "/actions/4?tab=content#details"],
    [
      ActionEditorSection.TaskForm,
      "/actions/4?tab=content&view=task-form#task-form",
    ],
  ])("puts %s on its tab", (section, path) => {
    expect(actionSectionPath(4, section)).toBe(path);
  });
});

describe("moveToTab", () => {
  it("drops the old tab's view and keeps the other params", () => {
    const params = new URLSearchParams("tab=content&view=task-form&resp_tab=x");
    moveToTab(params, { tab: WorkspaceTab.Responses });
    expect(params.toString()).toBe("tab=responses&resp_tab=x");
  });
});

describe("projectActionRedirect", () => {
  it("lands a section anchor on its tab", () => {
    expect(
      projectActionRedirect({ actionId: "4", search: "", hash: "#task-form" }),
    ).toBe("/actions/4?tab=content&view=task-form#task-form");
  });

  it("carries any other search and hash over", () => {
    expect(
      projectActionRedirect({ actionId: "4", search: "?a=1", hash: "#top" }),
    ).toBe("/actions/4?a=1#top");
  });
});
