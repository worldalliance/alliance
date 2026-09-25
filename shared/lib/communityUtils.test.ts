import {
  groupAssignmentLabels,
  groupRemovalMessage,
  isLedBy,
} from "./communityUtils";

describe("groupAssignmentLabels", () => {
  it("names an assignment for someone in no group", () => {
    expect(
      groupAssignmentLabels({ isMember: false, didGroupsFail: false }),
    ).toEqual({
      headingSuffix: " (assigning...)",
      cancelLabel: "Cancel assignment",
    });
  });

  it("names a reassignment for a member", () => {
    expect(
      groupAssignmentLabels({ isMember: true, didGroupsFail: false }),
    ).toEqual({
      headingSuffix: " (reassigning...)",
      cancelLabel: "Cancel reassignment",
    });
  });

  it("names neither while your groups won't load", () => {
    expect(
      groupAssignmentLabels({ isMember: false, didGroupsFail: true }),
    ).toEqual({ headingSuffix: "", cancelLabel: "Cancel group assignment" });
  });
});

describe("isLedBy", () => {
  const community = { leaders: [{ id: 3 }, { id: 5 }] };

  it("is true only for a user among the leaders", () => {
    expect(isLedBy(community, 5)).toBe(true);
    expect(isLedBy(community, 4)).toBe(false);
  });

  it("is false when no one is signed in", () => {
    expect(isLedBy(community, undefined)).toBe(false);
  });
});

describe("groupRemovalMessage", () => {
  it("is null for someone in no group they don't lead", () => {
    expect(groupRemovalMessage([], "Garden Club")).toBeNull();
  });

  it("names the single current group", () => {
    expect(groupRemovalMessage([{ name: "Book Club" }], "Garden Club")).toBe(
      "Joining Garden Club will remove you from your current group (Book Club).",
    );
  });

  it("lists every current group without a target", () => {
    expect(
      groupRemovalMessage([{ name: "Book Club" }, { name: "Chess Club" }]),
    ).toBe(
      "You will be removed from the following groups: (Book Club, Chess Club).",
    );
  });
});
