import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";

const noComments = async () => ({ data: [] });

let createResponse: { data?: { id: number }; error?: unknown } = {
  data: { id: 7 },
};

let deleteFails = false;

afterEach(() => {
  deleteFails = false;
});

jest.mock("@alliance/shared/client", () => ({
  forumCreateComment: async () => createResponse,
  forumFindCommentsForPost: noComments,
  forumFindCommentsForActivity: noComments,
  forumFindCommentsForAction: noComments,
  forumDeleteComment: async () => {
    if (deleteFails) throw new Error("the request never landed");
    return {};
  },
  forumUpdateComment: async () => ({}),
  forumPinCommentAdmin: async () => ({}),
  forumLikeComment: async () => ({}),
  forumUnlikeComment: async () => ({}),
}));

import { useCommentTree } from "./CommentsContext";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

afterEach(() => {
  createResponse = { data: { id: 7 } };
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

  createResponse = { error: { message: "Nothing to reply to" } };
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

  createResponse = { error: { message: "Nothing to reply to" } };
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
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  await act(async () => {
    await result.current.handleDeleteReply(5);
  });
  confirm.mockRestore();

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
  expect(result.current.error).toBeNull();

  await act(async () => {
    await result.current.fetchComments();
  });

  expect(result.current.deleteErrorFor(5)).toBe("Failed to delete reply");
});
