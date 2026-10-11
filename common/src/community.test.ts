import { checkCommunityAccessRules, isMaxCapacityRequired } from "./community";
import { R } from "./result";

describe("isMaxCapacityRequired", () => {
  const closed = {
    public: false,
    allowMemberInvites: false,
    allowStaffAssignments: false,
  };

  it("is false when only leaders can add members", () => {
    expect(isMaxCapacityRequired(closed)).toBe(false);
  });

  it("is true when any other path can add members", () => {
    expect(isMaxCapacityRequired({ ...closed, public: true })).toBe(true);
    expect(isMaxCapacityRequired({ ...closed, allowMemberInvites: true })).toBe(
      true,
    );
    expect(
      isMaxCapacityRequired({ ...closed, allowStaffAssignments: true }),
    ).toBe(true);
  });
});

describe("checkCommunityAccessRules", () => {
  const open = {
    public: true,
    allowMemberInvites: true,
    allowStaffAssignments: true,
    maxCapacity: 10,
  };

  it("accepts a capped open group and an uncapped closed one", () => {
    expect(checkCommunityAccessRules(open).ok).toBe(true);
    expect(
      checkCommunityAccessRules({
        public: false,
        allowMemberInvites: false,
        allowStaffAssignments: false,
        maxCapacity: null,
      }).ok,
    ).toBe(true);
  });

  it("rejects an uncapped group others can add members to", () => {
    expect(
      checkCommunityAccessRules({
        ...open,
        public: false,
        allowMemberInvites: false,
        maxCapacity: null,
      }),
    ).toEqual(
      R.failure(
        "Capacity is required when the group is public or allows member invites or staff assignments",
      ),
    );
  });

  it("rejects a public group that turns off member invites or staff assignments", () => {
    for (const flag of ["allowMemberInvites", "allowStaffAssignments"]) {
      expect(checkCommunityAccessRules({ ...open, [flag]: false })).toEqual(
        R.failure(
          "A public group must allow member invites and staff assignments",
        ),
      );
    }
  });
});
