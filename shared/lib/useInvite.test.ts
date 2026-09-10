import type { ReferrerProfileDto } from "../client";
import { namedInviter } from "./useInvite";

const user: ReferrerProfileDto = {
  kind: "user",
  displayName: "Mark Xu",
  profilePicture: null,
};

describe("namedInviter", () => {
  it("names a member who invited you", () => {
    expect(namedInviter(user)).toBe(user);
  });

  // A campaign signs nothing and invites nobody by name, so "X invited you to
  // the Alliance" would be a lie.
  it("names nobody for a campaign code", () => {
    expect(
      namedInviter({
        kind: "campaign",
        displayName: "Democratic Grantmaking",
        profilePicture: null,
      }),
    ).toBeNull();
  });

  it("names nobody when the code resolved to nothing", () => {
    expect(namedInviter(null)).toBeNull();
  });
});
