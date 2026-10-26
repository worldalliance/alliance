import { BadRequestException } from "@nestjs/common";
import {
  assertCanManageCommunity,
  canManageCommunity,
} from "./community-permissions";

describe("canManageCommunity", () => {
  const leaderOf7 = { admin: false, leaderOfIdSet: new Set([7]) };
  const admin = { admin: true, leaderOfIdSet: new Set<number>() };

  it.each([
    {
      who: "a leader of the community",
      user: leaderOf7,
      id: 7,
      expected: true,
    },
    {
      who: "a leader of another community",
      user: leaderOf7,
      id: 8,
      expected: false,
    },
    {
      who: "a leader, with no community",
      user: leaderOf7,
      id: null,
      expected: false,
    },
    { who: "an admin", user: admin, id: 8, expected: true },
    {
      who: "an admin, with no community",
      user: admin,
      id: null,
      expected: true,
    },
  ])("is $expected for $who", ({ user, id, expected }) => {
    expect(canManageCommunity(user, id)).toBe(expected);
  });
});

describe("assertCanManageCommunity", () => {
  const leaderOf7 = { admin: false, leaderOfIdSet: new Set([7]) };

  it("passes a leader of the community", () => {
    expect(() => assertCanManageCommunity(leaderOf7, 7)).not.toThrow();
  });

  it("refuses anyone else with a 400 naming the community", () => {
    expect(() => assertCanManageCommunity(leaderOf7, 8)).toThrow(
      new BadRequestException("User is not a leader of community 8"),
    );
  });
});
