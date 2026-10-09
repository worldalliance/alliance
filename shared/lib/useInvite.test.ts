import { act, renderHook, waitFor } from "@testing-library/react";
import type {
  OnetimeInviteDto,
  OnetimeInviteStatus,
  ReferrerProfileDto,
} from "../client";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  InviteAvailability,
  InviteRefusal,
  namedInviter,
  useInvite,
} from "./useInvite";

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
let referrerStatus = 200;
let inviteStatus = 200;

serveApi(
  routes({
    "GET /user/referrerProfile/:code": () =>
      referrerStatus !== 200
        ? Response.json({}, { status: referrerStatus })
        : Response.json({
            kind: "user",
            displayName: "Jane Smith",
            profilePicture: null,
          }),
    "GET /user/onetimeInvite/:code": ({ params }) =>
      inviteStatus !== 200
        ? Response.json({}, { status: inviteStatus })
        : Response.json({
            id: 1,
            invitee: "Sam",
            code: params.code,
            createdAt: new Date().toISOString(),
            status,
            invitedUserId: null,
            accepted: false,
          } satisfies OnetimeInviteDto),
  }),
);

const settle = async () => {
  const { result } = renderHook(() => useInvite("CODE"), queryWrapper());
  await waitFor(() => expect(result.current.pending).toBe(false));
  return result.current;
};

describe("useInvite", () => {
  beforeEach(() => {
    status = "link_unused";
    referrerStatus = 200;
    inviteStatus = 200;
  });

  it("offers an unused invite and names its inviter", async () => {
    const invite = await settle();
    expect(invite.refusal).toBeNull();
    expect(invite.inviter?.displayName).toBe("Jane Smith");
    expect(invite.availability).toBe(InviteAvailability.Available);
  });

  it("offers a personal or reusable code with no onetime invite", async () => {
    inviteStatus = 404;
    const invite = await settle();
    expect(invite.unresolved).toBe(false);
    expect(invite.inviter?.displayName).toBe("Jane Smith");
    expect(invite.availability).toBe(InviteAvailability.Available);
  });

  it("finds a code unavailable only when both lookups name nothing", async () => {
    inviteStatus = 404;
    referrerStatus = 404;
    const invite = await settle();
    expect(invite.unresolved).toBe(true);
    expect(invite.availability).toBe(InviteAvailability.Unavailable);
  });

  it("leaves a code it could not check to signup", async () => {
    inviteStatus = 503;
    referrerStatus = 503;
    const invite = await settle();
    expect(invite.unresolved).toBe(false);
    expect(invite.refusal).toBeNull();
    expect(invite.availability).toBe(InviteAvailability.Unknown);
  });

  it("leaves a code to signup when only the referrer lookup fails", async () => {
    inviteStatus = 404;
    referrerStatus = 503;
    const invite = await settle();
    expect(invite.unresolved).toBe(false);
    expect(invite.refusal).toBeNull();
  });

  it("keeps a settled answer when a refetch fails", async () => {
    inviteStatus = 404;
    referrerStatus = 404;
    const { client, wrapper } = queryWrapper();
    const { result } = renderHook(() => useInvite("CODE"), { wrapper });
    await waitFor(() => expect(result.current.unresolved).toBe(true));

    inviteStatus = 503;
    referrerStatus = 503;
    await act(() => client.refetchQueries());
    await waitFor(() =>
      expect(
        client.getQueryState(queryKeys.referrerProfile("CODE"))?.status,
      ).toBe("error"),
    );

    expect(result.current.unresolved).toBe(true);
  });

  it("is not checking when there is no code", () => {
    const { result } = renderHook(() => useInvite(null), queryWrapper());
    expect(result.current.availability).toBe(InviteAvailability.Unknown);
  });

  it("is checking while a lookup is in flight", () => {
    const { result } = renderHook(() => useInvite("CODE"), queryWrapper());
    expect(result.current.availability).toBe(InviteAvailability.Checking);
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
    expect(invite.availability).toBe(InviteAvailability.Unavailable);
  });
});
