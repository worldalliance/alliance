import { isMaxCapacityRequired } from "./community";

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
