import { describe, expect, it } from "bun:test";
import {
  formHref,
  groupHref,
  koraAssignmentHref,
  koraTranscriptPreviewHref,
  memberHref,
  memberListHref,
  projectHref,
  suiteHref,
  taskHref,
  taskUpdateHref,
  threadHref,
  videoHref,
} from "./hrefs";

describe("hrefs", () => {
  it("builds each record's path from its id", () => {
    expect(memberHref(7)).toBe("/members/7");
    expect(groupHref(7)).toBe("/members/groups/7");
    expect(memberListHref("new")).toBe("/members/lists/new");
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
  });

  it("names a tab other than the first in the query", () => {
    expect(formHref(7, "responses")).toBe("/tasks/forms/7?tab=responses");
    expect(suiteHref(7, "launch")).toBe("/tasks/suites/7?tab=launch");
  });

  it("leaves the first tab as the bare URL", () => {
    expect(formHref(7, "builder")).toBe("/tasks/forms/7");
    expect(taskHref(7, "overview")).toBe("/tasks/7");
  });
});
