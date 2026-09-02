import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { CommentDto, CommentParentObject } from "../client";

const requests: { endpoint: string; id: string }[] = [];
let served: CommentDto[] = [];
let unreachable = false;

const record =
  (endpoint: string) => async (options: { path: { id: string } }) => {
    requests.push({ endpoint, id: options.path.id });
    if (unreachable) throw new TypeError("Failed to fetch");
    return { data: served };
  };

jest.mock("@alliance/shared/client", () => ({
  forumFindCommentsForPost: record("post"),
  forumFindCommentsForActivity: record("activity"),
  forumFindCommentsForAction: record("action"),
}));

import { useLoadComments } from "./useLoadComments";

const comment = (id: number): CommentDto => ({
  id,
  parentObjectType: "post",
  parentObjectId: 7,
  deleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  pinned: false,
  tagId: null,
  author: {
    id: 1,
    displayName: "Jane Smith",
    profilePicture: "",
    admin: false,
    staff: false,
    ambassador: false,
    profileDescription: null,
    hasActiveContract: true,
    isCommunityLeader: false,
    anonymous: false,
  },
  children: [],
  likes: [],
  likesCount: 0,
  editableContent: { body: "a comment", attachments: [] },
});

afterEach(() => {
  requests.length = 0;
  served = [];
  unreachable = false;
  cleanup();
});

const endpointFor: Record<CommentParentObject, string> = {
  post: "post",
  activity: "activity",
  action: "action",
};

for (const type of Object.keys(endpointFor) as CommentParentObject[]) {
  it(`asks the ${type} endpoint for a ${type} thread`, async () => {
    renderHook(() => useLoadComments({ objectId: 7, type }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests).toEqual([{ endpoint: endpointFor[type], id: "7" }]);
  });
}

it("skips the request when the caller already has the thread", async () => {
  const initialComments = [comment(3)];

  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );

  await waitFor(() => expect(result.current.comments).toBe(initialComments));
  expect(requests).toEqual([]);
});

it("takes the thread the caller hands down after a refresh", async () => {
  const { result, rerender } = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );

  const refreshed = [comment(3), comment(4)];
  rerender({ initialComments: refreshed });

  await waitFor(() => expect(result.current.comments).toEqual(refreshed));
  expect(requests).toEqual([]);
});

it("keeps one caller's thread out of another's", async () => {
  const card = renderHook(
    ({ initialComments }: { initialComments: CommentDto[] }) =>
      useLoadComments({ objectId: 7, type: "post", initialComments }),
    { initialProps: { initialComments: [comment(3)] } },
  );
  await waitFor(() => expect(card.result.current.comments).toHaveLength(1));

  served = [comment(3), comment(4)];
  const screen = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post" }),
  );
  await waitFor(() => expect(screen.result.current.comments).toHaveLength(2));

  // The feed the card follows refreshed while the screen sat over it.
  card.rerender({ initialComments: [comment(3), comment(9)] });

  await waitFor(() =>
    expect(card.result.current.comments?.map((c) => c.id)).toEqual([3, 9]),
  );
  expect(screen.result.current.comments).toHaveLength(2);
});

it("keeps the thread when a refetch never reaches the server", async () => {
  const initialComments = [comment(3)];
  const { result } = renderHook(() =>
    useLoadComments({ objectId: 7, type: "post", initialComments }),
  );
  await waitFor(() => expect(result.current.comments).toHaveLength(1));

  unreachable = true;
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => {
    await result.current.fetchComments();
  });

  expect(result.current.comments).toHaveLength(1);
  expect(logged).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
  logged.mockRestore();
});
