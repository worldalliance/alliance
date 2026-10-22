import type { UserCommentDto } from "@alliance/shared/client";
import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import ForumActivityCommentCard from "./ForumActivityCommentCard";

const date = new Date().toISOString();

const actionComment: UserCommentDto = {
  id: 22,
  parentObjectType: "action",
  parentObjectId: 3,
  parentTitle: "Test Action",
  deleted: false,
  createdAt: date,
  updatedAt: date,
  parentId: null,
  pinned: false,
  tagId: null,
  author: makeProfile(7),
  likes: [],
  likesCount: 0,
  editableContent: { body: "", attachments: [] },
};

it("opens the comment from its parent title with one history entry", async () => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <ForumActivityCommentCard comment={actionComment} />,
      },
      { path: "*", element: null },
    ],
    { initialEntries: ["/"] },
  );
  render(
    <SiteAppProvider>
      <RouterProvider router={router} />
    </SiteAppProvider>,
  );

  fireEvent.click(screen.getByText("Test Action"));
  expect(router.state.location.pathname + router.state.location.search).toBe(
    "/actions/3?replyId=22",
  );

  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toBe("/");
});
