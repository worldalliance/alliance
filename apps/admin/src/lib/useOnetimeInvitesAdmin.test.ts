import type {
  OnetimeInviteListDto,
  OnetimeInviteMemberStatsDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useCreateOnetimeInviteAdmin,
  useOnetimeInviteMemberStatsAdmin,
  useOnetimeInvitesAdmin,
} from "./useOnetimeInvitesAdmin";

afterEach(cleanup);

const invites = {
  items: [],
  totalCount: 0,
  page: 1,
  limit: 50,
  totalPages: 0,
} satisfies OnetimeInviteListDto;

const memberStats = [
  {
    invitingUser: { id: 3, displayName: "Sam", profilePicture: null },
    sent: 2,
    accepted: 1,
  },
] satisfies OnetimeInviteMemberStatsDto[];

const listQueries: string[] = [];
const created: unknown[] = [];
let createStatus = 200;

serveApi(
  routes({
    "GET /user/onetimeInvites": ({ request }) => {
      listQueries.push(new URL(request.url).search);
      return Response.json(invites);
    },
    "GET /user/onetimeInvites/memberStats": () => Response.json(memberStats),
    "POST /user/onetimeInvite/create": async ({ request }) => {
      created.push(await request.json());
      return Response.json({}, { status: createStatus });
    },
  }),
);

afterEach(() => {
  listQueries.length = 0;
  created.length = 0;
  createStatus = 200;
});

describe("useOnetimeInvitesAdmin", () => {
  it("reads the first page of invites", async () => {
    const view = renderHook(() => useOnetimeInvitesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(invites));
    expect(listQueries).toEqual(["?page=1&limit=50"]);
  });
});

describe("useOnetimeInviteMemberStatsAdmin", () => {
  it("reads the per-member stats", async () => {
    const view = renderHook(
      () => useOnetimeInviteMemberStatsAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(memberStats));
  });
});

describe("useCreateOnetimeInviteAdmin", () => {
  const body = { invitingUserId: 3, invitee: "Alex" };

  const seeded = () => {
    const query = queryWrapper();
    query.client.setQueryData(queryKeys.onetimeInvitesAdmin(2, 50), invites);
    query.client.setQueryData(
      queryKeys.onetimeInviteMemberStatsAdmin(),
      memberStats,
    );
    const invalidated = () =>
      [
        queryKeys.onetimeInvitesAdmin(2, 50),
        queryKeys.onetimeInviteMemberStatsAdmin(),
      ].map((key) => query.client.getQueryState(key)?.isInvalidated);
    return { query, invalidated };
  };

  it("creates an invite and refreshes every invites page and the stats", async () => {
    const { query, invalidated } = seeded();
    const view = renderHook(() => useCreateOnetimeInviteAdmin(), query);

    await view.result.current.mutateAsync(body);

    expect(created).toEqual([body]);
    await waitFor(() => expect(invalidated()).toEqual([true, true]));
  });

  it("leaves the invites and stats alone after a refusal", async () => {
    createStatus = 403;
    const { query, invalidated } = seeded();
    const view = renderHook(() => useCreateOnetimeInviteAdmin(), query);

    await expect(view.result.current.mutateAsync(body)).rejects.toBeDefined();

    expect(invalidated()).toEqual([false, false]);
  });
});
