import {
  groupAssignmentLabels,
  groupRemovalMessage,
  isLedBy,
  publicGroupJoinState,
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

describe("publicGroupJoinState", () => {
  const community = {
    users: [{}, {}, {}],
    leaders: [{ id: 1 }],
    maxCapacity: 3,
  };
  const base = {
    community,
    userId: 7,
    isMember: false,
    isJoining: false,
    didGroupsFail: false,
  };

  it("offers Join to an outsider while there is room", () => {
    expect(publicGroupJoinState(base)).toEqual({
      disabled: false,
      label: "Join",
    });
  });

  it("is full once members, not counting leaders, reach capacity", () => {
    expect(
      publicGroupJoinState({
        ...base,
        community: { ...community, users: [{}, {}, {}, {}] },
      }),
    ).toEqual({ disabled: true, label: "Full" });
  });

  it("names the leader before membership or capacity", () => {
    expect(
      publicGroupJoinState({
        ...base,
        userId: 1,
        isMember: true,
        community: { ...community, users: [{}, {}, {}, {}] },
      }),
    ).toEqual({ disabled: true, label: "Leader" });
  });

  it("names a member before capacity", () => {
    expect(
      publicGroupJoinState({
        ...base,
        isMember: true,
        community: { ...community, users: [{}, {}, {}, {}] },
      }),
    ).toEqual({ disabled: true, label: "Member" });
  });

  it("disables while joining", () => {
    expect(publicGroupJoinState({ ...base, isJoining: true })).toEqual({
      disabled: true,
      label: "Joining…",
    });
  });

  it("disables Join while your groups won't load", () => {
    expect(publicGroupJoinState({ ...base, didGroupsFail: true })).toEqual({
      disabled: true,
      label: "Join",
    });
  });
});
