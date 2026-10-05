import type { PostDto } from "@alliance/shared/client/types.gen";
import { makeProfile, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import PostsManagement from "./PostsManagement";

afterEach(cleanup);

const post = {
  id: 1,
  title: "Town hall",
  authorId: 2,
  actionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  pinned: false,
  visibleAt: null,
  deleted: false,
  qaMode: false,
  expertLabel: null,
  expertIds: [],
  authorIds: [],
  notifyForReplies: false,
  showClusterTags: false,
  author: makeProfile(2),
  editableContent: { body: "", attachments: [] },
} satisfies PostDto;

const failure = () => Response.json({}, { status: 500 });
let userList = failure;

serveApi(
  routes({
    "GET /forum/admin/posts": () => Response.json([post]),
    "GET /user/list": () => userList(),
  }),
);

afterEach(() => {
  userList = failure;
});

const renderPage = () => {
  const query = queryWrapper();
  render(
    <MemoryRouter initialEntries={["/posts/1"]}>
      <ToastProvider>
        <Routes>
          <Route path="/posts/:postId?" element={<PostsManagement />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
  return query.client;
};

it("says when the user list fails to load", async () => {
  renderPage();

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

it("stays quiet when a refetch fails after the users loaded", async () => {
  userList = () => Response.json([makeUser({ id: 7, name: "Ana" })]);
  const client = renderPage();
  await screen.findByText("Authors");
  await waitFor(() => expect(client.isFetching()).toBe(0));

  userList = failure;
  await client.refetchQueries();
  await waitFor(() => expect(client.isFetching()).toBe(0));

  expect(screen.queryByText("Failed to load users.")).toBeNull();
});
