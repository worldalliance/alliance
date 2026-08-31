import { CommentDto } from "@alliance/shared/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
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
