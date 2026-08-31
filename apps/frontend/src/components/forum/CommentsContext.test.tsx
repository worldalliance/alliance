import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";

const noComments = async () => ({ data: [] });

jest.mock("@alliance/shared/client", () => ({
  forumCreateComment: async () => ({ data: { id: 7 } }),
  forumFindCommentsForPost: noComments,
  forumFindCommentsForActivity: noComments,
  forumFindCommentsForAction: noComments,
  forumDeleteComment: async () => ({}),
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
