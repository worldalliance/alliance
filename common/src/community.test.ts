import {
  checkCommunityAccessRules,
  isMaxCapacityRequired,
  validateCommunitySettings,
} from "./community";
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

describe("validateCommunitySettings", () => {
  const settings = {
    name: "  North  ",
    public: false,
    allowMemberInvites: true,
    allowStaffAssignments: true,
    maxCapacity: 10,
  };

  it("trims the name and keeps a required capacity", () => {
    expect(validateCommunitySettings({ settings, memberCount: 3 })).toEqual(
      R.success({ name: "North", maxCapacity: 10 }),
    );
  });

  it("sends no capacity when nothing requires one", () => {
    expect(
      validateCommunitySettings({
        settings: {
          ...settings,
          allowMemberInvites: false,
          allowStaffAssignments: false,
        },
        memberCount: 0,
      }),
    ).toEqual(R.success({ name: "North", maxCapacity: null }));
  });

  it("rejects a blank name", () => {
    expect(
      validateCommunitySettings({
        settings: { ...settings, name: "   " },
        memberCount: 0,
      }),
    ).toEqual(R.failure("Name is required"));
  });

  it("rejects a missing or non-positive capacity where one is required", () => {
    for (const maxCapacity of [null, undefined, 0, -1]) {
      expect(
        validateCommunitySettings({
          settings: { ...settings, maxCapacity },
          memberCount: 0,
        }),
      ).toEqual(
        R.failure(
          "Capacity is required when the group is public or allows member invites or staff assignments",
        ),
      );
    }
  });

  it("rejects a public group that turns off staff assignments", () => {
    expect(
      validateCommunitySettings({
        settings: { ...settings, public: true, allowStaffAssignments: false },
        memberCount: 0,
      }),
    ).toEqual(
      R.failure(
        "A public group must allow member invites and staff assignments",
      ),
    );
  });

  it("rejects a capacity below the member count", () => {
    expect(
      validateCommunitySettings({
        settings: { ...settings, maxCapacity: 2 },
        memberCount: 3,
      }),
    ).toEqual(
      R.failure(
        "Capacity cannot be less than the current number of members (3)",
      ),
    );
  });

  it("allows a capacity below the member count when given none", () => {
    expect(
      validateCommunitySettings({
        settings: { ...settings, maxCapacity: 2 },
        memberCount: null,
      }),
    ).toEqual(R.success({ name: "North", maxCapacity: 2 }));
  });
});
