import { describe, expect, it } from "bun:test";
import {
  contractHref,
  formHref,
  formulaHref,
  generalUpdateHref,
  groupHref,
  inviteFeedHref,
  koraAssignmentHref,
  koraTranscriptPreviewHref,
  MEMBER_LISTS_HREF,
  memberHref,
  memberListHref,
  projectHref,
  projectTaskHref,
  suiteHref,
  taskHref,
  taskUpdateHref,
  threadHref,
  videoHref,
} from "./hrefs";
import { ActionEditorSection } from "./staffTestingGate";

describe("hrefs", () => {
  it("builds each record's path from its id", () => {
    expect(memberHref(7)).toBe("/members/7");
    expect(groupHref(7)).toBe("/members/groups/7");
    expect(memberListHref("new")).toBe("/members/lists/new");
    expect(memberListHref("abc")).toBe("/members/lists/abc");
    expect(MEMBER_LISTS_HREF).toBe("/members/lists");
    expect(taskHref(7)).toBe("/tasks/7");
    expect(taskUpdateHref({ actionId: 7, updateId: 8 })).toBe(
      "/tasks/7/updates/8",
    );
    expect(suiteHref(7)).toBe("/tasks/suites/7");
    expect(projectHref(7)).toBe("/tasks/projects/7");
    expect(formHref(7)).toBe("/tasks/forms/7");
    expect(threadHref("t-1")).toBe("/inbox/t-1");
    expect(videoHref(7)).toBe("/content/media/videos/7");
    expect(koraAssignmentHref("a-1")).toBe("/research/assignments/a-1");
    expect(koraTranscriptPreviewHref("b-1")).toBe("/research/preview/b-1");
    expect(formulaHref(7)).toBe("/tasks/formulas/7");
    expect(contractHref(7)).toBe("/tasks/contracts/7");
    expect(generalUpdateHref(7)).toBe("/content/general-updates/7");
    expect(inviteFeedHref).toBe("/growth/invites/feed");
  });

  it("names a tab other than the first in the query", () => {
    expect(formHref(7, "responses")).toBe("/tasks/forms/7?tab=responses");
    expect(suiteHref(7, "launch")).toBe("/tasks/suites/7?tab=launch");
    expect(generalUpdateHref(7, "content")).toBe(
      "/content/general-updates/7?tab=content",
    );
  });

  it("leaves the first tab as the bare URL", () => {
    expect(formHref(7, "builder")).toBe("/tasks/forms/7");
    expect(taskHref(7, "overview")).toBe("/tasks/7");
  });

  it("builds the create page of a record made on its own page", () => {
    expect(formulaHref("new")).toBe("/tasks/formulas/new");
    expect(contractHref("new")).toBe("/tasks/contracts/new");
    expect(suiteHref("new")).toBe("/tasks/suites/new");
    expect(generalUpdateHref("new")).toBe("/content/general-updates/new");
  });

  it("builds a task under its project, at a section when one is named", () => {
    const task = { projectId: 3, actionId: 7 };
    expect(projectTaskHref(task)).toBe("/tasks/projects/3/tasks/7");
    expect(
      projectTaskHref({ ...task, hash: ActionEditorSection.Release }),
    ).toBe("/tasks/projects/3/tasks/7#release");
  });
});
