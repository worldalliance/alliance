import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Suspense } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { answerLeaveGuard } from "../../lib/testing/leaveGuard";
import { postAdmin } from "../../lib/testing/postAdmin";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import PostsPage from "./PostsPage";

afterEach(cleanup);

const failure = () => Response.json({}, { status: 500 });
const townHall = () =>
  postAdmin(1, "Town hall", {
    tags: [{ id: 5, name: "Question", sortOrder: 0 }],
  });
const listPosts = () => Response.json([townHall(), postAdmin(2, "Housing")]);
let saved: unknown = null;
const savePost = async (request: Request) => {
  saved = await request.json();
  return Response.json({ ...townHall(), qaMode: true });
};
let postList = listPosts;
let postSave: (request: Request) => Response | Promise<Response> = savePost;
let userList = failure;

serveApi(
  routes({
    "GET /forum/admin/posts": () => postList(),
    "PATCH /forum/admin/posts/:id/settings": ({ request }) => postSave(request),
    "GET /user/list": () => userList(),
  }),
);

afterEach(() => {
  postList = listPosts;
  postSave = savePost;
  userList = failure;
  saved = null;
});

const renderPage = (url = "/content/posts/1") => {
  const query = queryWrapper();
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Suspense>
              <Outlet />
            </Suspense>
          </LeaveGuard>
        ),
        children: [{ path: "/content/posts/:postId?", element: <PostsPage /> }],
      },
    ],
    { initialEntries: [url] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return { client: query.client, router };
};

const sheet = async () => within(await screen.findByRole("dialog"));

it("says when the user list fails to load", async () => {
  renderPage();

  // Both people pickers, authors and experts, read the user list.
  expect(await screen.findAllByText("Failed to load users.")).toHaveLength(2);
});

it("keeps the authors and Q&A notes in view once people are picked", async () => {
  userList = () => Response.json([makeUser({ id: 7, name: "Ana" })]);
  postList = () =>
    Response.json([
      postAdmin(1, "Town hall", { authorIds: [7], expertIds: [7] }),
    ]);
  renderPage();
  const dialog = await sheet();

  expect(
    await dialog.findByText(
      "Every listed author is notified of new comments on this post.",
    ),
  ).toBeTruthy();
  expect(dialog.getAllByText("Turn on Q&A mode to use this.")).toHaveLength(2);
});

it("stays quiet when a refetch fails after the users loaded", async () => {
  userList = () => Response.json([makeUser({ id: 7, name: "Ana" })]);
  const { client } = renderPage();
  await (await sheet()).findByText("Authors");
  await waitFor(() => expect(client.isFetching()).toBe(0));

  userList = failure;
  await client.refetchQueries();
  await waitFor(() => expect(client.isFetching()).toBe(0));

  expect(screen.queryByText("Failed to load users.")).toBeNull();
});

it("says when the posts fail to load", async () => {
  postList = failure;
  renderPage();

  expect(await screen.findByText("Couldn't load posts")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No forum posts yet")).toBeNull();
});

it("lists a post's saved settings", async () => {
  renderPage();
  fireEvent.click((await sheet()).getByLabelText("Q&A mode"));
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Save changes" }),
  );

  expect(await screen.findByText("Post settings saved")).toBeTruthy();
  const row = screen.getByText("Town hall", { selector: "a" }).closest("tr");
  if (!row) throw new Error("no Town hall row");
  await waitFor(() => expect(within(row).getAllByText("On")).toHaveLength(1));
});

it("says why a save was refused", async () => {
  postSave = () =>
    Response.json({ message: "Unknown expert" }, { status: 400 });
  renderPage();
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Save changes" }),
  );

  expect(await screen.findByText("Couldn't save: Unknown expert")).toBeTruthy();
});

it("says the session expired when a save is refused for it", async () => {
  postSave = () => Response.json({}, { status: 401 });
  renderPage();
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Save changes" }),
  );

  expect(
    await screen.findByText(`Couldn't save: ${sessionExpiredMessage}`),
  ).toBeTruthy();
});

it("refuses two tags with one name", async () => {
  renderPage();
  const body = await sheet();
  fireEvent.click(body.getByRole("button", { name: "Add tag" }));
  fireEvent.change(body.getByLabelText("Tag 2"), {
    target: { value: " Question " },
  });
  fireEvent.click(body.getByRole("button", { name: "Save changes" }));

  expect(await body.findByText("Give each tag a different name")).toBeTruthy();
  expect(saved).toBeNull();
});

it("asks before a save deletes a tag, and keeps it when declined", async () => {
  renderPage();
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Remove tag: Question" }),
  );
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Save changes" }),
  );
  const question = await screen.findByRole("dialog", {
    name: "Delete the tag “Question”?",
  });
  expect(
    within(question).getByText(
      "Comments filed under that tag lose their label. This can't be undone.",
    ),
  ).toBeTruthy();
  fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: /Delete the tag/ })).toBeNull(),
  );
  expect(saved).toBeNull();
});

it("sends the remaining tags once the deletion is confirmed", async () => {
  renderPage();
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Remove tag: Question" }),
  );
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Save changes" }),
  );
  const question = await screen.findByRole("dialog", {
    name: "Delete the tag “Question”?",
  });
  fireEvent.click(within(question).getByRole("button", { name: "Delete tag" }));

  await waitFor(() =>
    expect(saved).toMatchObject({ tags: { tags: [], knownTagIds: [5] } }),
  );
});

it("saves against the loaded tags when a refetch brings another admin's tag", async () => {
  const { client } = renderPage();
  fireEvent.click((await sheet()).getByLabelText("Notify for replies"));
  postList = () =>
    Response.json([
      postAdmin(1, "Town hall", {
        tags: [
          { id: 5, name: "Question", sortOrder: 0 },
          { id: 9, name: "Added elsewhere", sortOrder: 1 },
        ],
      }),
      postAdmin(2, "Housing"),
    ]);
  await client.refetchQueries();
  await waitFor(() => expect(client.isFetching()).toBe(0));
  fireEvent.click(
    (await sheet()).getByRole("button", { name: "Save changes" }),
  );

  await waitFor(() => expect(saved).not.toBeNull());
  expect(screen.queryByRole("dialog", { name: /Delete the tag/ })).toBeNull();
  expect(saved).toMatchObject({ notifyForReplies: true });
  expect(saved).not.toHaveProperty("tags");
});

it("asks before closing the sheet over unsaved settings", async () => {
  const answered = answerLeaveGuard(false);
  const { router } = renderPage();
  fireEvent.click((await sheet()).getByLabelText("Notify for replies"));
  fireEvent.click((await sheet()).getByRole("button", { name: "Close" }));

  await waitFor(() => expect(answered).toHaveBeenCalledTimes(1));
  expect(router.state.location.pathname).toBe("/content/posts/1");
  answered.mockRestore();
});

it("says a post the list doesn't hold isn't found", async () => {
  renderPage("/content/posts/99");

  expect(
    await (
      await sheet()
    ).findByText("It isn't among the forum's posts. It may have been deleted."),
  ).toBeTruthy();
});
