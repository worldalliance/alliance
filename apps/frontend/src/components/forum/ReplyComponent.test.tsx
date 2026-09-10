import { R } from "@alliance/common/result";
import { CommentDto } from "@alliance/shared/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CommentsProvider } from "./CommentsContext";
import ReplyComponent from "./ReplyComponent";

afterEach(cleanup);

const author: CommentDto["author"] = {
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
};

const reply = (id: number, children: CommentDto[] = []): CommentDto => ({
  id,
  parentObjectType: "post",
  parentObjectId: 1,
  deleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pinned: false,
  tagId: null,
  author,
  children,
  likes: [],
  likesCount: 0,
  editableContent: { body: `comment ${id}`, attachments: [] },
});

const dismissed: number[] = [];

const renderReply = (deleteErrorFor: (replyId: number) => string | null) => {
  dismissed.length = 0;
  const ctx = {
    user: undefined,
    replyingTo: null,
    setReplyingTo: () => {},
    handleSubmitReply: () => Promise.resolve(),
    handleDeleteReply: () => Promise.resolve(),
    onUpdateReply: () => Promise.resolve(R.success<void>(undefined)),
    submitErrorFor: () => null,
    clearSubmitError: () => {},
    deleteErrorFor,
    clearDeleteError: (replyId: number) => dismissed.push(replyId),
    onLikeReply: () => Promise.resolve(),
    onPinReply: () => Promise.resolve(),
    newlyAddedReplies: new Set<number>(),
    highlightedReplyId: null,
    expertIds: [],
    tags: [],
  };

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CommentsProvider value={ctx}>
          <ReplyComponent reply={reply(5, [reply(6)])} />
        </CommentsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

it("says a delete failed under the reply it was asked of", () => {
  renderReply((replyId) => (replyId === 5 ? "Failed to delete reply" : null));

  const alert = screen.getByRole("alert");

  expect(alert.textContent).toContain("Failed to delete reply");
});

it("takes back the message the reader dismissed and no other", () => {
  renderReply(() => "Failed to delete reply");

  const dismissals = screen.getAllByLabelText("Dismiss this message");
  fireEvent.click(dismissals[1]);

  expect(dismissals).toHaveLength(2);
  expect(dismissed).toEqual([6]);
});
