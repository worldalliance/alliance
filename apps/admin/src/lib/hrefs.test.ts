import { describe, expect, it } from "bun:test";
import {
  groupHref,
  memberHref,
  projectHref,
  suiteHref,
  taskHref,
} from "./hrefs";

describe("hrefs", () => {
  it("builds each record's path from its id", () => {
    expect(memberHref(7)).toBe("/members/7");
    expect(groupHref(7)).toBe("/members/groups/7");
    expect(taskHref(7)).toBe("/tasks/7");
    expect(suiteHref(7)).toBe("/tasks/suites/7");
    expect(projectHref(7)).toBe("/tasks/projects/7");
  });
});
