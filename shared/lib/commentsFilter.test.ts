import { CommentDto, UserDto } from "@alliance/shared/client";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  CommentFilter,
  CommentSort,
  sortComments,
  useCommentFilterData,
  useCommentFiltering,
} from "./commentsFilter";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useRemoveFriendMutation, useUserFriendsQuery } from "./user";

const comment = (
  id: number,
  createdAt: string,
  {
    pinned = false,
    children = [],
  }: { pinned?: boolean; children?: CommentDto[] } = {},
) => ({ id, createdAt, pinned, children }) as CommentDto;

const ALL_FRIENDS = [
  { id: 1, displayName: "Ada" },
  { id: 2, displayName: "Grace" },
];
let friends = ALL_FRIENDS;

serveApi(
  routes({
    "GET /user/listfriends/:id": () => Response.json(friends),
    "DELETE /user/friends/:targetUserId": ({ params }) => {
      friends = friends.filter((f) => f.id !== Number(params.targetUserId));
      return new Response(null, { status: 200 });
    },
    "GET /community/list/my": () => Response.json([]),
  }),
);

afterEach(() => {
  friends = ALL_FRIENDS;
  cleanup();
});

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

    const list = renderHook(() => useUserFriendsQuery(7), { wrapper });

    expect(list.result.current.data?.map((f) => f.displayName)).toEqual([
      "Ada",
      "Grace",
    ]);
  });

  it("drops a friend removed from their profile page", async () => {
    const { wrapper } = queryWrapper();
    const filter = renderHook(
      () => useCommentFilterData({ enabled: true, userId: 7 }),
      { wrapper },
    );
    await waitFor(() =>
      expect([...filter.result.current.friendIdSet]).toEqual([1, 2]),
    );

    const removeFriend = renderHook(() => useRemoveFriendMutation(), {
      wrapper,
    });
    await act(() => removeFriend.result.current.mutateAsync(2));

    await waitFor(() =>
      expect([...filter.result.current.friendIdSet]).toEqual([1]),
    );
  });
});

describe("useCommentFiltering", () => {
  const authored = (
    id: number,
    authorId: number,
    extra: Partial<CommentDto> = {},
  ) =>
    ({
      ...comment(id, "2024-01-01T00:00:00Z"),
      author: { id: authorId },
      ...extra,
    }) as CommentDto;
  const user = { id: 7, clusterId: 3 } as UserDto;

  const render = (comments: CommentDto[]) =>
    renderHook(
      ({ comments, showClusterTags }) =>
        useCommentFiltering({
          comments,
          user,
          showClusterTags,
          isPostComments: false,
          activeQaMode: false,
          expertIds: [],
          tags: [],
          tagFilter: undefined,
        }),
      {
        initialProps: { comments, showClusterTags: true },
        wrapper: queryWrapper().wrapper,
      },
    );

  it("hides deleted comments without replies and offers the viewer's own", () => {
    const { result } = render([
      authored(1, 7),
      authored(2, 8),
      authored(3, 8, { deleted: true }),
      authored(4, 8, { deleted: true, children: [authored(5, 7)] }),
    ]);

    expect(result.current.topLevelComments.map((c) => c.id)).toEqual([1, 2, 4]);
    expect(result.current.filterOptions).toContain(CommentFilter.Mine);
    expect(result.current.commentSort).toBe(CommentSort.SameCluster);

    act(() => result.current.setCommentFilter(CommentFilter.Mine));

    expect(result.current.filteredComments.map((c) => c.id)).toEqual([1]);
  });

  it("falls back to all comments once the chosen filter is no longer offered", () => {
    const { result, rerender } = render([authored(1, 7), authored(2, 8)]);
    act(() => result.current.setCommentFilter(CommentFilter.Mine));

    rerender({ comments: [authored(2, 8)], showClusterTags: true });

    expect(result.current.commentFilter).toBe(CommentFilter.All);
    expect(result.current.filteredComments.map((c) => c.id)).toEqual([2]);
  });

  it("falls back to newest once the introduction group sort is no longer offered", () => {
    const comments = [authored(1, 7)];
    const { result, rerender } = render(comments);

    rerender({ comments, showClusterTags: false });

    expect(result.current.commentSort).toBe(CommentSort.Newest);
  });

  it("reshuffles each time random is picked", () => {
    const comments = [1, 2, 3, 4, 5, 6].map((id) => authored(id, 8));
    const orderFor = (randomSeed: string) =>
      sortComments(comments, CommentSort.Random, { randomSeed }).map(
        (c) => c.id,
      );
    expect(orderFor("0.1")).not.toEqual(orderFor("0.2"));
    const random = jest.spyOn(Math, "random");
    const { result } = render(comments);

    random.mockReturnValue(0.1);
    act(() => result.current.changeSort(CommentSort.Random));
    const first = result.current.filteredComments.map((c) => c.id);
    random.mockReturnValue(0.2);
    act(() => result.current.changeSort(CommentSort.Random));
    const second = result.current.filteredComments.map((c) => c.id);
    random.mockRestore();

    expect(first).toEqual(orderFor("0.1"));
    expect(second).toEqual(orderFor("0.2"));
  });
});
