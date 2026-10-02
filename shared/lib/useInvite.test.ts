import { renderHook, waitFor } from "@testing-library/react";
import type {
  OnetimeInviteDto,
  OnetimeInviteStatus,
  ReferrerProfileDto,
} from "../client";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { InviteRefusal, namedInviter, useInvite } from "./useInvite";

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

let status: OnetimeInviteStatus = "link_unused";

serveApi(
  routes({
    "GET /user/referrerProfile/:code": () =>
      Response.json({
        kind: "user",
        displayName: "Jane Smith",
        profilePicture: null,
      }),
    "GET /user/onetimeInvite/:code": ({ params }) =>
      Response.json({
        id: 1,
        invitee: "Sam",
        code: params.code,
        createdAt: new Date().toISOString(),
        status,
        invitedUserId: null,
      } satisfies OnetimeInviteDto),
  }),
);

const settle = async () => {
  const { result } = renderHook(() => useInvite("CODE"), queryWrapper());
  await waitFor(() => expect(result.current.pending).toBe(false));
  return result.current;
};

describe("useInvite", () => {
  it("offers an unused invite and names its inviter", async () => {
    status = "link_unused";
    const invite = await settle();
    expect(invite.refusal).toBeNull();
    expect(invite.inviter?.displayName).toBe("Jane Smith");
  });

  it.each<[OnetimeInviteStatus, InviteRefusal]>([
    ["link_used", InviteRefusal.Used],
    ["request_pending", InviteRefusal.Unapproved],
    ["request_rejected", InviteRefusal.Unapproved],
  ])("refuses a %s invite as %s", async (refused, refusal) => {
    status = refused;
    const invite = await settle();
    expect(invite.refusal).toBe(refusal);
    expect(invite.inviter).toBeNull();
  });
});
