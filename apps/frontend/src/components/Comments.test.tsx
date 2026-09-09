import { CommentDto } from "@alliance/shared/client";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { MemoryRouter } from "react-router";

let markdownParses = 0;
let commentRenders = 0;

jest.mock("@alliance/sharedweb/ui/AppMarkdownWrapper", () => ({
  __esModule: true,
  default: ({ markdownContent }: { markdownContent: string }) => {
    markdownParses++;
    return <div>{markdownContent}</div>;
  },
}));

jest.mock("@alliance/sharedweb/ui/UserDisplayName", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => {
    commentRenders++;
    return <span>{children}</span>;
  },
}));

import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import Comments from "./Comments";

const noop = () => Promise.resolve();

const loggedOut: AuthContextType = {
  isAuthenticated: false,
  user: undefined,
  isImpersonation: false,
  refreshUser: noop,
  login: noop,
  onLogin: noop,
  logout: noop,
  loading: false,
};

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

const comments: CommentDto[] = [1, 2, 3].map((id) => ({
  id,
  parentObjectType: "post",
  parentObjectId: 1,
  deleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pinned: false,
  tagId: null,
  author,
  children: [],
  likes: [],
  likesCount: 0,
  editableContent: { body: `comment ${id}`, attachments: [] },
}));

let rerenderParent = () => {};

const Parent = () => {
  const [count, setCount] = useState(0);
  rerenderParent = () => setCount((current) => current + 1);
  return (
    <div>
      <span>count {count}</span>
      <Comments objectId={1} type="post" initialComments={comments} />
    </div>
  );
};

it("leaves the comment tree alone when something above it renders", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuthContext.Provider value={loggedOut}>
          <Parent />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText("comment 1");

  const parsesOnMount = markdownParses;
  const rendersOnMount = commentRenders;
  expect(parsesOnMount).toBe(comments.length);

  act(() => rerenderParent());
  await screen.findByText("count 1");

  expect(markdownParses).toBe(parsesOnMount);
  expect(commentRenders).toBe(rendersOnMount);
});

const loggedIn: AuthContextType = {
  ...loggedOut,
  isAuthenticated: true,
  user: testAuthUser,
};

// Nothing else in this file cleans up, and a second thread carrying the same
// comment bodies makes every query below ambiguous.
const renderThread = (
  discussionClosed: boolean,
  thread: CommentDto[] = comments,
) => {
  cleanup();
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ToastProvider>
          <AuthContext.Provider value={loggedIn}>
            <Comments
              objectId={1}
              type="post"
              initialComments={thread}
              discussionClosed={discussionClosed}
            />
          </AuthContext.Provider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

it("takes away every way to say something new, keeping the thread", async () => {
  const open = renderThread(false);
  await open.findByText("comment 1");

  expect(open.queryByRole("textbox")).not.toBeNull();
  expect(open.queryAllByText("Reply")).toHaveLength(comments.length);

  const closed = renderThread(true);
  await closed.findByText("comment 1");

  expect(closed.queryByRole("textbox")).toBeNull();
  expect(closed.queryAllByText("Reply")).toHaveLength(0);
});

it("leaves an author the edit and delete the server still takes", async () => {
  const closed = renderThread(true);
  await closed.findByText("comment 1");

  expect(closed.queryAllByLabelText("More options")).toHaveLength(
    comments.length,
  );
});

it("keeps a like already left on a closed thread, offering no new one", async () => {
  const thread = renderThread(true, [
    { ...comments[0], likedByMe: true },
    { ...comments[1], likedByMe: false },
  ]);
  await thread.findByText("comment 1");

  const [mine, theirs] = thread.getAllByRole("button", { name: "Like" });
  expect((mine as HTMLButtonElement).disabled).toBe(false);
  expect((theirs as HTMLButtonElement).disabled).toBe(true);
});
