import type {
  InviteLinkKind,
  InviteLinkPageDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useInviteLinksAdmin } from "./useInviteLinksAdmin";

const links = {
  items: [
    {
      id: "share:1",
      label: "Link 1",
      kind: "multi_use",
      url: "https://example.com/signup?ref=link-1",
      createdAt: "2026-09-01T12:00:00.000Z",
      accountsCreated: 8,
      initialSigners: 4,
      retainedSigners: 3,
    },
  ],
  totalCount: 51,
  page: 1,
  limit: 50,
  totalPages: 2,
} satisfies InviteLinkPageDto;

const searchQueries: string[] = [];
let searchStatus = 200;

serveApi(
  routes({
    "GET /share-urls/admin/invite-links": ({ request }) => {
      searchQueries.push(new URL(request.url).search);
      return Response.json(links, { status: searchStatus });
    },
  }),
);

afterEach(() => {
  searchQueries.length = 0;
  searchStatus = 200;
});

describe("useInviteLinksAdmin", () => {
  it("reads the first page of every kind and caches it", async () => {
    const { client, wrapper } = queryWrapper();
    const view = renderHook(
      () => useInviteLinksAdmin({ kind: undefined, sort: "newest" }),
      { wrapper },
    );

    await waitFor(() => expect(view.result.current.data).toEqual(links));
    expect(searchQueries).toEqual(["?sort=newest&page=1&limit=50"]);
    expect(
      client.getQueryData(
        queryKeys.inviteLinksAdmin({
          kind: undefined,
          sort: "newest",
          page: 1,
          limit: 50,
        }),
      ),
    ).toEqual(links);
  });

  it("filters by kind, sorts, and reads the page asked for", async () => {
    const view = renderHook(
      () => useInviteLinksAdmin({ kind: "individual", sort: "most_used" }),
      queryWrapper(),
    );
    await waitFor(() => expect(view.result.current.data).toEqual(links));

    act(() => view.result.current.setPage(2));

    await waitFor(() =>
      expect(searchQueries).toEqual([
        "?kind=individual&sort=most_used&page=1&limit=50",
        "?kind=individual&sort=most_used&page=2&limit=50",
      ]),
    );
  });

  it("reads the new kind when the kind changes", async () => {
    const { wrapper } = queryWrapper();
    const initialProps: { kind: InviteLinkKind | undefined } = {
      kind: undefined,
    };
    const view = renderHook(
      ({ kind }) => useInviteLinksAdmin({ kind, sort: "newest" }),
      { wrapper, initialProps },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(links));

    view.rerender({ kind: "individual" });

    await waitFor(() =>
      expect(searchQueries).toEqual([
        "?sort=newest&page=1&limit=50",
        "?kind=individual&sort=newest&page=1&limit=50",
      ]),
    );
  });

  it("reports a failed load", async () => {
    searchStatus = 500;
    const view = renderHook(
      () => useInviteLinksAdmin({ kind: undefined, sort: "newest" }),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.data).toBeUndefined();
  });
});
