import type {
  OnetimeInviteDto,
  OnetimeInviteListDto,
  ReusableInviteFeedDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { InviteFeedKind, useInviteFeedAdmin } from "./useInviteFeedAdmin";

const START_AT = "2026-10-01T00:00:00.000Z";

const onetimeInvite = (
  id: number,
  createdAt: string,
  status: OnetimeInviteDto["status"] = "link_unused",
) =>
  ({
    id,
    invitee: "Alex",
    inviteeDescription: null,
    info: null,
    code: `code-${id}`,
    createdAt,
    status,
    invitedUserId: null,
    invitingUser: {
      id: 3,
      admin: false,
      staff: false,
      ambassador: false,
      profilePicture: null,
      profileDescription: null,
      anonymous: false,
      displayName: "Sam",
      hasActiveContract: true,
      isCommunityLeader: false,
    },
    accepted: false,
  }) satisfies OnetimeInviteDto;

const page = (
  items: OnetimeInviteDto[],
  pageNumber: number,
  totalPages: number,
) =>
  ({
    items,
    totalCount: items.length,
    page: pageNumber,
    limit: 200,
    totalPages,
  }) satisfies OnetimeInviteListDto;

let onetimePages: OnetimeInviteListDto[] = [];
let reusableFeed: ReusableInviteFeedDto = { items: [] };
let onetimeStatus = 200;
let reusableStatus = 200;
const onetimeQueries: string[] = [];
const reusableQueries: string[] = [];

serveApi(
  routes({
    "GET /user/onetimeInvites": ({ request }) => {
      const search = new URL(request.url).searchParams;
      onetimeQueries.push(`?${search.toString()}`);
      return Response.json(onetimePages[Number(search.get("page")) - 1], {
        status: onetimeStatus,
      });
    },
    "GET /share-urls/invite-feed": ({ request }) => {
      reusableQueries.push(new URL(request.url).search);
      return Response.json(reusableFeed, { status: reusableStatus });
    },
  }),
);

afterEach(() => {
  onetimePages = [];
  reusableFeed = { items: [] };
  onetimeStatus = 200;
  reusableStatus = 200;
  onetimeQueries.length = 0;
  reusableQueries.length = 0;
});

describe("useInviteFeedAdmin", () => {
  it("merges created one-time invites and reusable invites since the start", async () => {
    onetimePages = [
      page(
        [
          onetimeInvite(2, "2026-10-02T00:00:00.000Z"),
          onetimeInvite(3, "2026-10-02T00:00:00.000Z", "request_pending"),
          onetimeInvite(1, "2026-09-30T00:00:00.000Z"),
        ],
        1,
        1,
      ),
    ];
    reusableFeed = {
      items: [
        {
          id: "abc",
          createdAt: "2026-10-03T00:00:00.000Z",
          invitingUserDisplayName: "Robin",
          communityId: null,
        },
      ],
    };

    const view = renderHook(() => useInviteFeedAdmin(START_AT), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([
        {
          id: "onetime-2",
          createdAt: "2026-10-02T00:00:00.000Z",
          invitingUserDisplayName: "Sam",
          kind: InviteFeedKind.Individual,
        },
        {
          id: "reusable-abc",
          createdAt: "2026-10-03T00:00:00.000Z",
          invitingUserDisplayName: "Robin",
          kind: InviteFeedKind.Group,
        },
      ]),
    );
    expect(onetimeQueries).toEqual(["?page=1&limit=200"]);
    expect(reusableQueries).toEqual([
      `?startAt=${encodeURIComponent(START_AT)}`,
    ]);
  });

  it("reads further one-time pages until one reaches past the start", async () => {
    onetimePages = [
      page([onetimeInvite(3, "2026-10-03T00:00:00.000Z")], 1, 3),
      page([onetimeInvite(2, "2026-09-30T00:00:00.000Z")], 2, 3),
      page([onetimeInvite(1, "2026-09-29T00:00:00.000Z")], 3, 3),
    ];

    const view = renderHook(() => useInviteFeedAdmin(START_AT), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data?.map((item) => item.id)).toEqual([
        "onetime-3",
      ]),
    );
    expect(onetimeQueries).toEqual(["?page=1&limit=200", "?page=2&limit=200"]);
  });

  it("requests nothing without a start", () => {
    const view = renderHook(() => useInviteFeedAdmin(null), queryWrapper());

    expect(view.result.current.fetchStatus).toBe("idle");
    expect(onetimeQueries).toEqual([]);
    expect(reusableQueries).toEqual([]);
  });

  it.each([
    ["one-time invites", () => (onetimeStatus = 500)],
    ["reusable invites", () => (reusableStatus = 500)],
  ])("fails when the %s fail to load", async (_source, fail) => {
    onetimePages = [page([], 1, 0)];
    fail();

    const view = renderHook(() => useInviteFeedAdmin(START_AT), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
  });
});
