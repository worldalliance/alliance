import type { PostDto, UpdatePostSettingsDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";
import { postAdmin } from "./testing/postAdmin";
import { usePostsAdmin } from "./usePostsAdmin";

let listStatus = 200;
let updateStatus = 200;
let updateBody: UpdatePostSettingsDto | undefined;

serveApi(
  routes({
    "GET /forum/admin/posts": () =>
      listStatus === 200
        ? Response.json([postAdmin(1, "Town hall"), postAdmin(2, "AMA")])
        : Response.json({}, { status: listStatus }),
    "PATCH /forum/admin/posts/:id/settings": async ({ request, params }) => {
      if (updateStatus !== 200) {
        return Response.json(
          { message: "Unknown tag" },
          { status: updateStatus },
        );
      }
      updateBody = await request.json();
      return Response.json(
        postAdmin(Number(params.id), "AMA", { qaMode: true }),
      );
    },
  }),
);

beforeEach(() => {
  listStatus = 200;
  updateStatus = 200;
  updateBody = undefined;
});

const body = {
  expertIds: [],
  authorIds: [],
  qaMode: true,
  expertLabel: null,
  notifyForReplies: false,
  showClusterTags: false,
} satisfies UpdatePostSettingsDto;

const renderPosts = (query = queryWrapper()) =>
  renderHook(() => usePostsAdmin(), query);

const cachedQaModes = (query: ReturnType<typeof queryWrapper>) =>
  query.client
    .getQueryData<PostDto[]>(queryKeys.postsAdmin())
    ?.map((p) => p.qaMode);

describe("usePostsAdmin", () => {
  it("loads the posts", async () => {
    const view = renderPosts();
    await waitFor(() =>
      expect(view.result.current.posts.data?.map((p) => p.title)).toEqual([
        "Town hall",
        "AMA",
      ]),
    );
  });

  it("fails the load when the server refuses it", async () => {
    listStatus = 500;
    const view = renderPosts();
    await waitFor(() => expect(view.result.current.posts.isError).toBe(true));
  });

  it("saves a post's settings into the cached list", async () => {
    const query = queryWrapper();
    const view = renderPosts(query);
    await waitFor(() => expect(view.result.current.posts.data).toBeDefined());

    const updated = await act(() =>
      view.result.current.updateSettings.mutateAsync({ id: 2, body }),
    );

    expect(updated.qaMode).toBe(true);
    expect(updateBody).toEqual(body);
    await waitFor(() => expect(cachedQaModes(query)).toEqual([false, true]));
  });

  it("leaves the cached list alone when a save is refused", async () => {
    updateStatus = 400;
    const query = queryWrapper();
    const view = renderPosts(query);
    await waitFor(() => expect(view.result.current.posts.data).toBeDefined());

    await act(() =>
      expect(
        view.result.current.updateSettings.mutateAsync({ id: 2, body }),
      ).rejects.toMatchObject({ statusCode: 400 }),
    );

    expect(cachedQaModes(query)).toEqual([false, false]);
  });
});
