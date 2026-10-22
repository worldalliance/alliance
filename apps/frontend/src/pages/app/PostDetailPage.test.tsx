import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser, testForumPosts } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import PostDetailPage from "./PostDetailPage";

const post = {
  ...testForumPosts[0],
  id: 7,
  title: "My thread",
  authorId: testAuthUser.id,
  author: { ...testForumPosts[0].author, id: testAuthUser.id },
};

let removeResponse: () => Response;
let forumLoaded: ReturnType<typeof Promise.withResolvers<null>>;

serveApi(
  routes({
    "GET /forum/posts/7": () => Response.json(post),
    "DELETE /forum/posts/7": () => removeResponse(),
    "GET /forum/posts/7/comments": () => Response.json([]),
    "GET /community/list/my": () => Response.json([]),
    "GET /user/listfriends/:id": () => Response.json([]),
  }),
);

beforeEach(() => {
  removeResponse = () => new Response(null);
  forumLoaded = Promise.withResolvers<null>();
  window.confirm = () => true;
});

const renderPostPage = () => {
  const { wrapper: QueryWrapper } = queryWrapper();
  const router = createMemoryRouter(
    [
      { path: "/forum/post/:id", element: <PostDetailPage /> },
      {
        path: "/forum",
        loader: () => forumLoaded.promise,
        element: <p>the forum</p>,
      },
    ],
    { initialEntries: ["/forum/post/7"] },
  );
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider value={authValue({ user: testAuthUser })}>
          <SiteAppProvider>
            <RouterProvider router={router} />
          </SiteAppProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
};

const deletePost = async () => {
  await screen.findByText("My thread");
  await act(async () => {
    fireEvent.click(screen.getByText("Delete"));
  });
};

describe("PostDetailPage", () => {
  it("leaves for the forum without saying the deleted post is missing", async () => {
    renderPostPage();

    await deletePost();

    expect(screen.queryByText("Post not found")).toBeNull();
    await act(async () => forumLoaded.resolve(null));
    expect(await screen.findByText("the forum")).toBeDefined();
  });

  it("stays on the post when the delete is refused", async () => {
    removeResponse = () => Response.json({}, { status: 404 });
    renderPostPage();

    await deletePost();

    expect(await screen.findByText("Failed to delete post")).toBeDefined();
    expect(screen.queryByText("the forum")).toBeNull();
  });
});
