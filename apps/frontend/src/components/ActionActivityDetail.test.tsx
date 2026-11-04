import { activityStore } from "@alliance/shared/lib/activityStore";
import {
  makeAction,
  makeActivity,
  makeProfile,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { authValue } from "../testing/authValue";
import ActionActivityDetail, {
  type ActionActivityDetailContext,
} from "./ActionActivityDetail";
import * as CommentsModule from "./Comments";

beforeEach(() => {
  jest.spyOn(CommentsModule, "default").mockImplementation(() => <></>);
});

const action = makeAction({ id: 3 });

const fetched = makeActivity({
  id: 9,
  actionId: action.id,
  actionName: action.name,
  user: { ...makeProfile(5), displayName: "Grace Hopper" },
});

serveApi(
  routes({
    "GET /actions/activities/:id": () => Response.json(fetched),
    "POST /actions/likeActivity/:id": () =>
      Response.json({ likes: [], likesCount: 4, likedByMe: true }),
  }),
);

function ActivityOutlet() {
  return <Outlet context={{ action } satisfies ActionActivityDetailContext} />;
}

const renderDetail = () => {
  const query = queryWrapper();
  const router = createMemoryRouter(
    [
      {
        path: "/actions/:id/activity",
        element: <ActivityOutlet />,
        children: [{ path: ":activityId", element: <ActionActivityDetail /> }],
      },
    ],
    { initialEntries: [`/actions/${action.id}/activity/${fetched.id}`] },
  );
  render(
    <QueryClientProvider client={query.client}>
      <AuthContext.Provider value={authValue({ user: makeUser() })}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return query.client;
};

it("shows the fetched activity, and a like updates its record", async () => {
  const client = renderDetail();
  await screen.findByText("Grace Hopper");

  fireEvent.click(screen.getByRole("button", { name: /like/i }));

  await waitFor(() =>
    expect(activityStore(client).getActivity(fetched.id)).toMatchObject({
      likedByMe: true,
      likesCount: 4,
    }),
  );
});
