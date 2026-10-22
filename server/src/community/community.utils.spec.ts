import { User } from "src/user/entities/user.entity";
import { groupJoinAudience } from "./community.utils";
import { Community } from "./entities/community.entity";

const user = (id: number) => Object.assign(new User(), { id });

describe("groupJoinAudience", () => {
  it("is the members who don't lead the group", () => {
    const leader = user(1);
    const member = user(2);
    const community = Object.assign(new Community(), {
      id: 10,
      users: [leader, member],
      leaders: [leader, user(3)],
    });

    expect(groupJoinAudience(community)).toEqual([member]);
  });

  it("throws when the leaders aren't loaded", () => {
    const community = Object.assign(new Community(), {
      id: 10,
      users: [user(1)],
    });

    expect(() => groupJoinAudience(community)).toThrow(
      "leaders of community 10 not loaded",
    );
  });
});
