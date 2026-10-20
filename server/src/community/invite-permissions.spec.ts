import { canModifyInvite } from "./invite-permissions";

describe("canModifyInvite", () => {
  const viewer = (fields: {
    id?: number;
    admin: boolean;
    leaderOf: number[];
  }) => ({
    id: fields.id ?? 2,
    admin: fields.admin,
    leaderOfIdSet: new Set(fields.leaderOf),
  });

  it.each([
    {
      who: "the inviter",
      user: viewer({ id: 1, admin: false, leaderOf: [] }),
      invite: { invitingUserId: 1, communityId: 7 },
      expected: true,
    },
    {
      who: "a leader of the invite's community",
      user: viewer({ admin: false, leaderOf: [7] }),
      invite: { invitingUserId: 1, communityId: 7 },
      expected: true,
    },
    {
      who: "a leader of another community",
      user: viewer({ admin: false, leaderOf: [8] }),
      invite: { invitingUserId: 1, communityId: 7 },
      expected: false,
    },
    {
      who: "a leader, on an invite with no community",
      user: viewer({ admin: false, leaderOf: [7] }),
      invite: { invitingUserId: 1, communityId: null },
      expected: false,
    },
    {
      who: "a member, on an invite with no inviter",
      user: viewer({ admin: false, leaderOf: [] }),
      invite: { invitingUserId: null, communityId: 7 },
      expected: false,
    },
    {
      who: "an admin",
      user: viewer({ admin: true, leaderOf: [] }),
      invite: { invitingUserId: null, communityId: null },
      expected: true,
    },
  ])("is $expected for $who", ({ user, invite, expected }) => {
    expect(canModifyInvite(user, invite)).toBe(expected);
  });
});
