import { R } from "@alliance/common/result";
import { CommentDto, UserDto } from "@alliance/shared/client";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CommentsProvider } from "./CommentsContext";
import ReplyComponent from "./ReplyComponent";

let user: UserDto | undefined;
let replyingTo: number | null = null;

afterEach(() => {
  user = undefined;
  replyingTo = null;
});

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
  parentId: null,
  pinned: false,
  tagId: null,
  author,
  children,
  likes: [],
  likesCount: 0,
  editableContent: { body: `comment ${id}`, attachments: [] },
});

const dismissed: number[] = [];

const renderReply = (
  deleteErrorFor: (replyId: number) => string | null,
  root = reply(5, [reply(6)]),
) => {
  dismissed.length = 0;
  const ctx = {
    user,
    replyingTo,
    setReplyingTo: () => {},
    handleSubmitReply: () => Promise.resolve(),
    handleDeleteReply: () => Promise.resolve(),
    onUpdateReply: () => Promise.resolve(R.success<void>(undefined)),
    submitErrorFor: (parentId: number | null) =>
      parentId !== null && parentId === replyingTo
        ? "The reply you're answering is no longer here"
        : null,
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
        <SiteAppProvider>
          <ToastProvider>
            <CommentsProvider value={ctx}>
              <ReplyComponent reply={root} />
            </CommentsProvider>
          </ToastProvider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

it("says a delete failed under the reply it was asked of", () => {
  renderReply((replyId) => (replyId === 5 ? "Failed to delete reply" : null));

  expect(
    screen.getByText("Failed to delete reply").closest('[role="alert"]'),
  ).not.toBeNull();
});

it("takes back the message the reader dismissed and no other", () => {
  renderReply(() => "Failed to delete reply");

  const dismissals = screen.getAllByLabelText("Dismiss this message");
  fireEvent.click(dismissals[1]);

  expect(dismissals).toHaveLength(2);
  expect(dismissed).toEqual([6]);
});

it("offers no like on a deleted reply kept for the replies under it", () => {
  renderReply(() => null, {
    ...reply(5, [reply(6)]),
    deleted: true,
    likesCount: 2,
  });

  expect(screen.getAllByRole("button", { name: "Like" })).toHaveLength(1);
  expect(screen.queryByText("2 others like this")).toBeNull();
});

it("offers no reply to a deleted reply kept for the replies under it", () => {
  user = makeUser();
  renderReply(() => null, { ...reply(5, [reply(6)]), deleted: true });

  expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
});

it("keeps a deleted reply the reader is answering, with the refusal under it", () => {
  user = makeUser();
  replyingTo = 6;
  renderReply(() => null, reply(5, [{ ...reply(6), deleted: true }]));

  expect(
    screen
      .getByText("The reply you're answering is no longer here")
      .closest('[role="alert"]'),
  ).not.toBeNull();
});

it("drops a deleted reply without replies once nobody is answering it", () => {
  renderReply(() => null, reply(5, [{ ...reply(6), deleted: true }]));

  expect(document.getElementById("reply-6")).toBeNull();
  expect(document.getElementById("reply-5")).not.toBeNull();
});
