import type {
  OnetimeInviteListDto,
  OnetimeInviteMemberStatsDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
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

serveApi(
  routes({
    "GET /user/onetimeInvites": ({ request }) => {
      listQueries.push(new URL(request.url).search);
      return Response.json(invites);
    },
    "GET /user/onetimeInvites/memberStats": () => Response.json(memberStats),
  }),
);

afterEach(() => {
  listQueries.length = 0;
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
