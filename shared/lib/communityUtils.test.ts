import { groupAssignmentLabels } from "./communityUtils";

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
