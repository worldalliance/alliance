import { canModifyOnetimeInvite, OnetimeInvite } from "./onetime-invite.entity";
import { User } from "./user.entity";

describe("canModifyOnetimeInvite", () => {
  const inviter = Object.assign(new User(), { id: 1 });
  const invite = Object.assign(new OnetimeInvite(), {
    invitingUser: inviter,
    communityId: 7,
  });
  const viewer = (fields: {
    id?: number;
    admin: boolean;
    leaderOfIds: number[];
  }) => Object.assign(new User(), { id: 2, ...fields });

  it.each([
    {
      who: "the inviter",
      user: viewer({ id: 1, admin: false, leaderOfIds: [] }),
      expected: true,
    },
    {
      who: "a leader of the invite's community",
      user: viewer({ admin: false, leaderOfIds: [7] }),
      expected: true,
    },
    {
      who: "anyone else",
      user: viewer({ admin: false, leaderOfIds: [] }),
      expected: false,
    },
  ])("is $expected for $who", ({ user, expected }) => {
    expect(canModifyOnetimeInvite(user, invite)).toBe(expected);
  });
});
