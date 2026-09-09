import type { CommentDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";

let createError: { message: string } | null = null;

const storedComment: CommentDto = {
  id: 3,
  parentObjectType: "post",
  parentObjectId: 1,
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
};

const storedThread: CommentDto[] = [
  { ...storedComment, children: [{ ...storedComment, id: 4 }] },
  { ...storedComment, id: 5 },
];

let postCommentsFail = false;
let deleteFails = false;
let extraRoots: CommentDto[] = [];

serveApi(
  routes({
    "POST /forum/comments": () =>
      createError
        ? Response.json(createError, { status: 400 })
        : Response.json({ id: 7 }),
    "GET /forum/posts/:id/comments": () =>
      postCommentsFail
        ? Response.json(
            { statusCode: 403, message: "the server said no" },
            { status: 403 },
          )
        : Response.json([...storedThread, ...extraRoots]),
    "DELETE /forum/comments/:id": () => {
      if (deleteFails) throw new Error("the request never landed");
      return new Response(null, { status: 204 });
    },
  }),
);

afterEach(() => {
  postCommentsFail = false;
  deleteFails = false;
  extraRoots = [];
});

import { useCommentTree } from "./CommentsContext";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

afterEach(() => {
  createError = null;
});

it("leaves the reply target alone when a reply posts", async () => {
  const { result } = renderHook(() => useCommentTree(1, "post"), { wrapper });

  act(() => {
    result.current.setReplyingTo(5);
  });

  await act(async () => {
    await result.current.handleSubmitReply({
      body: "a reply",
      attachments: [],
    });
  });

  expect(result.current.replyingTo).toBe(5);
  expect(result.current.focusComposer).toBe(false);
});

it("leaves the composer free to take the caret when it posts itself", async () => {
  const { result } = renderHook(() => useCommentTree(1, "post"), { wrapper });

  await act(async () => {
    await result.current.handleSubmitReply({
      body: "a thread comment",
      attachments: [],
    });
  });

  expect(result.current.focusComposer).toBe(true);
});

it("drops a rejected reply's message when another form opens", async () => {
  const { result } = renderHook(() => useCommentTree(1, "post"), { wrapper });

  act(() => {
    result.current.setReplyingTo(5);
  });

  createError = { message: "Nothing to reply to" };
  await act(async () => {
    await result.current.handleSubmitReply({
      body: "a reply",
      attachments: [],
    });
  });

  expect(result.current.submitErrorFor(5)).toBe("Nothing to reply to");

  act(() => {
    result.current.setReplyingTo(9);
  });

  expect(result.current.submitErrorFor(5)).toBeNull();
});

it("keeps a rejection that landed while its own form was closed", async () => {
  const { result } = renderHook(() => useCommentTree(1, "post"), { wrapper });

  createError = { message: "Nothing to reply to" };
  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.handleSubmitReply({
      body: "a thread comment",
      attachments: [],
    });
  });
  act(() => {
    result.current.setReplyingTo(9);
  });
  await act(async () => {
    await pending;
  });

  act(() => {
    result.current.setReplyingTo(null);
  });

  expect(result.current.submitErrorFor(null)).toBe("Nothing to reply to");
});

it("keeps a failed delete out of the thread's error", async () => {
  const { result } = renderHook(() => useCommentTree(1, "post"), { wrapper });

  deleteFails = true;
  jest.spyOn(window, "confirm").mockReturnValue(true);
  await act(async () => {
    await result.current.handleDeleteReply(5);
  });

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
  expect(result.current.error).toBeNull();

  await act(async () => {
    await result.current.fetchComments();
  });

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
});

it("keeps the thread and reports the failure when a refetch fails", async () => {
  const { result } = renderHook(() => useCommentTree(1, "post"), { wrapper });

  await waitFor(() => expect(result.current.comments).toHaveLength(2));

  postCommentsFail = true;
  await act(async () => {
    await result.current.fetchComments();
  });

  await waitFor(() => expect(result.current.error).toBe("the server said no"));
  expect(result.current.comments).toHaveLength(2);

  postCommentsFail = false;
  await act(async () => {
    await result.current.fetchComments();
  });

  await waitFor(() => expect(result.current.error).toBeNull());
});

it("hands back the comment objects a refetch left alone", async () => {
  const { result } = renderHook(() => useCommentTree(1, "post"), { wrapper });

  await waitFor(() => expect(result.current.comments).toHaveLength(2));
  const [before] = result.current.comments ?? [];

  // The added root is the only signal that the refetch reached the render the
  // assertion below reads.
  extraRoots = [{ ...storedComment, id: 6 }];
  await act(async () => {
    await result.current.fetchComments();
  });
  await waitFor(() => expect(result.current.comments).toHaveLength(3));

  expect(result.current.comments?.[0]).toBe(before);
});
