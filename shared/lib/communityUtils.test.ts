import { groupAssignmentLabels, isLedBy } from "./communityUtils";

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
