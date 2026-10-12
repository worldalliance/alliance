import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { postAdmin } from "../lib/testing/postAdmin";
import PostsManagement from "./PostsManagement";

afterEach(cleanup);

const failure = () => Response.json({}, { status: 500 });
const listPosts = () => Response.json([postAdmin(1, "Town hall")]);
const savePost = () =>
  Response.json(postAdmin(1, "Town hall", { qaMode: true }));
let postList = listPosts;
let postSave = savePost;
let userList = failure;

serveApi(
  routes({
    "GET /forum/admin/posts": () => postList(),
    "PATCH /forum/admin/posts/:id/settings": () => postSave(),
    "GET /user/list": () => userList(),
  }),
);

afterEach(() => {
  postList = listPosts;
  postSave = savePost;
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

it("says when the posts fail to load", async () => {
  postList = failure;
  renderPage();

  expect(await screen.findByText("Failed to load posts.")).toBeTruthy();
});

it("lists a post's saved settings", async () => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Enable Q&A Mode"));
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(await screen.findByText("Settings saved successfully")).toBeTruthy();
  expect(screen.getByText("Q&A Mode Active")).toBeTruthy();
});

it("says why a save was refused", async () => {
  postSave = () =>
    Response.json({ message: "Unknown expert" }, { status: 400 });
  jest.spyOn(console, "error").mockImplementation(() => {});
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Save Changes" }));

  expect(await screen.findByText("Unknown expert")).toBeTruthy();
});

it("says the session expired when a save is refused for it", async () => {
  postSave = () => Response.json({}, { status: 401 });
  jest.spyOn(console, "error").mockImplementation(() => {});
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Save Changes" }));

  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});
