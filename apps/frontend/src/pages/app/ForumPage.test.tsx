import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { testForumPosts } from "../../stories/testData";
import ForumPage from "./ForumPage";

let posts = async () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

serveApi(routes({ "GET /forum/posts": () => posts() }));

afterEach(cleanup);

it("offers a retry when forum posts fail to load", async () => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <ForumPage />
    </MemoryRouter>,
    { wrapper },
  );
  await screen.findByText("Couldn't load forum posts.");
  expect(screen.queryByRole("status")).toBeNull();

  const { promise, resolve } = Promise.withResolvers<Response>();
  posts = () => promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() =>
    expect(screen.getByText("Try again").closest("button")?.disabled).toBe(
      true,
    ),
  );

  resolve(Response.json(testForumPosts.slice(0, 1)));
  await screen.findByText(testForumPosts[0].title);
  expect(screen.queryByText("Couldn't load forum posts.")).toBeNull();
});

it("shows a spinner until the first load lands", async () => {
  const { promise, resolve } = Promise.withResolvers<Response>();
  posts = () => promise;
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <ForumPage />
    </MemoryRouter>,
    { wrapper },
  );
  screen.getByRole("status");

  resolve(Response.json(testForumPosts.slice(0, 1)));
  await screen.findByText(testForumPosts[0].title);
  expect(screen.queryByRole("status")).toBeNull();
});
