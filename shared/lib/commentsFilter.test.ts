import { CommentDto, userListFriends } from "@alliance/shared/client";
import { useQuery } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  CommentSort,
  sortComments,
  useCommentFilterData,
} from "./commentsFilter";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";

const comment = (
  id: number,
  createdAt: string,
  {
    pinned = false,
    children = [],
  }: { pinned?: boolean; children?: CommentDto[] } = {},
) => ({ id, createdAt, pinned, children }) as CommentDto;

serveApi(
  routes({
    "GET /user/listfriends/:id": () =>
      Response.json([
        { id: 1, displayName: "Ada" },
        { id: 2, displayName: "Grace" },
      ]),
    "GET /community/list/my": () => Response.json([]),
  }),
);

afterEach(cleanup);

describe("sortComments by newest", () => {
  it("orders pinned comments by their most recent reply, then the rest by their own date", () => {
    const oldPinnedWithNewReply = comment(1, "2026-01-01T00:00:00Z", {
      pinned: true,
      children: [
        comment(2, "2026-01-02T00:00:00Z", {
          children: [comment(3, "2026-03-01T00:00:00Z")],
        }),
      ],
    });
    const newPinnedWithoutReplies = comment(4, "2026-02-01T00:00:00Z", {
      pinned: true,
    });
    const oldUnpinned = comment(5, "2026-01-15T00:00:00Z");
    const newUnpinned = comment(6, "2026-04-01T00:00:00Z");

    const sorted = sortComments(
      [
        oldPinnedWithNewReply,
        newPinnedWithoutReplies,
        oldUnpinned,
        newUnpinned,
      ],
      CommentSort.Newest,
    );

    expect(sorted.map((c) => c.id)).toEqual([1, 4, 6, 5]);
  });
});

describe("useCommentFilterData", () => {
  it("leaves friend profiles in the cache for screens that list them", async () => {
    const { wrapper } = queryWrapper();
    const filter = renderHook(
      () => useCommentFilterData({ enabled: true, userId: 7 }),
      { wrapper },
    );
    await waitFor(() =>
      expect([...filter.result.current.friendIdSet]).toEqual([1, 2]),
    );

    const list = renderHook(
      () =>
        useQuery({
          queryKey: ["userListFriends", 7],
          queryFn: () =>
            userListFriends({ path: { id: 7 } }).then((res) => res.data ?? []),
        }),
      { wrapper },
    );

    expect(list.result.current.data?.map((f) => f.displayName)).toEqual([
      "Ada",
      "Grace",
    ]);
  });
});
