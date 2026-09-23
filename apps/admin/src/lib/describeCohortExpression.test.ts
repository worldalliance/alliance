import { describe, expect, it } from "bun:test";
import {
  cohortSegmentsText,
  describeCohortExpression,
  type CohortNames,
} from "./describeCohortExpression";

const describeText = (
  ...args: Parameters<typeof describeCohortExpression>
): string => cohortSegmentsText(describeCohortExpression(...args));

const names: CohortNames = {
  tagNames: new Map([["tag-uuid", "Volunteers"]]),
  actionNames: new Map([[7, "Call your rep"]]),
};

describe("describeCohortExpression", () => {
  it("labels a single condition", () => {
    expect(describeText({ type: "NonUSMember" }, names)).toBe("Non-US Member");
  });

  it("says None without an expression", () => {
    expect(describeText(undefined, names)).toBe("None");
  });

  it("resolves tag and action names", () => {
    expect(
      describeText(
        {
          type: "AND",
          children: [
            { type: "Tag", tagId: "tag-uuid" },
            { type: "CompletedAction", actionId: 7 },
          ],
        },
        names,
      ),
    ).toBe("Tag: Volunteers and Completed Action: Call your rep");
  });

  it("falls back to ids for unknown tags and actions", () => {
    expect(
      describeText(
        {
          type: "OR",
          children: [
            { type: "Tag", tagId: "missing" },
            { type: "InProgressAction", actionId: 99 },
          ],
        },
        names,
      ),
    ).toBe("Tag: missing or In-Progress Action: #99");
  });

  it("parenthesizes nested operators", () => {
    expect(
      describeText(
        {
          type: "AND",
          children: [
            { type: "USMember" },
            {
              type: "NOT",
              child: {
                type: "OR",
                children: [
                  { type: "GroupLead" },
                  { type: "Manual", userIds: [1, 2] },
                ],
              },
            },
          ],
        },
        names,
      ),
    ).toBe("US Member and not (Group Lead or 2 manual users)");
  });

  it("tags leaf segments with their condition type", () => {
    expect(
      describeCohortExpression(
        { type: "NOT", child: { type: "NonUSMember" } },
        names,
      ),
    ).toEqual([
      { text: "not " },
      { text: "Non-US Member", leaf: "NonUSMember" },
    ]);
  });
});
