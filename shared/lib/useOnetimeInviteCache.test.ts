import { act, renderHook, waitFor } from "@testing-library/react";
import { makeOnetimeInvite } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityOnetimeInvites } from "./useCommunityOnetimeInvites";
import { useOnetimeInvitesOverview } from "./useOnetimeInvitesOverview";

let requested: string[] = [];

serveApi(
  routes({
    "GET /user/onetimeInvites/overview": () => {
      requested.push("overview");
      return Response.json([makeOnetimeInvite({ id: 1 })]);
    },
    "GET /user/onetimeInvites/:communityId": ({ params }) => {
      requested.push(`community ${params.communityId}`);
      return Response.json([makeOnetimeInvite({ id: 1 })]);
    },
    "POST /user/onetimeInvite/create": () =>
      Response.json(makeOnetimeInvite({ id: 2 })),
    "POST /user/onetimeInvite/:inviteId/approve": ({ params }) =>
      Response.json(makeOnetimeInvite({ id: Number(params.inviteId) })),
    "POST /user/onetimeInvite/:inviteId/reject": () =>
      new Response(null, { status: 200 }),
  }),
);

beforeEach(() => {
  requested = [];
});

const renderBoth = async () => {
  const { wrapper } = queryWrapper({ staleTime: Infinity });
  const hook = renderHook(
    () => ({
      overview: useOnetimeInvitesOverview(),
      group: useCommunityOnetimeInvites(7),
      otherGroup: useCommunityOnetimeInvites(8),
    }),
    { wrapper },
  );
  await waitFor(() => expect(requested).toHaveLength(3));
  requested = [];
  return hook;
};

it("refetches every group's invites, but not the overview it wrote, after an overview write", async () => {
  const hook = await renderBoth();

  await act(() =>
    hook.result.current.overview.createInvite({
      invitee: "Ada",
      communityId: 7,
    }),
  );

  await waitFor(() =>
    expect([...requested].sort()).toEqual(["community 7", "community 8"]),
  );
  expect(hook.result.current.overview.invites.map((i) => i.id)).toEqual([2, 1]);
});

it("refetches the overview and other groups, but not the group it wrote, after a group write", async () => {
  const hook = await renderBoth();

  await act(() => hook.result.current.group.approveInvite(1));

  await waitFor(() =>
    expect([...requested].sort()).toEqual(["community 8", "overview"]),
  );
});

it("refetches the overview and other groups, but not the group it wrote, after a group rejects an invite", async () => {
  const hook = await renderBoth();

  await act(() => hook.result.current.group.rejectInvite(1));

  await waitFor(() =>
    expect([...requested].sort()).toEqual(["community 8", "overview"]),
  );
  expect(hook.result.current.group.invites).toEqual([]);
});
