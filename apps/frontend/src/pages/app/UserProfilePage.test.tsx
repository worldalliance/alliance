import type {
  FriendStatusDto,
  ProfileDto,
  UserCompletedActionsCountDto,
} from "@alliance/shared/client";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { userQueryKeys } from "@alliance/shared/lib/user";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import UserProfilePage from "./UserProfilePage";

const GRACE: ProfileDto = {
  id: 2,
  admin: false,
  staff: false,
  ambassador: false,
  profilePicture: null,
  profileDescription: null,
  anonymous: false,
  displayName: "Grace",
  hasActiveContract: true,
  isCommunityLeader: false,
};

const empty = () => Response.json([]);

const api = serveApi(
  routes({
    "GET /user/slug/:id": () => Response.json(GRACE),
    "GET /user/myfriendrelationship/:id": () =>
      Response.json({
        status: "none",
        didReceiveRequest: false,
      } satisfies FriendStatusDto),
    "GET /user/listfriends/:id": empty,
    "GET /forum/posts/user/:id": empty,
    "GET /forum/posts/user/:id/comments": empty,
    "GET /actions/userFeed/:id": empty,
    "GET /actions/completed/:id": empty,
    "GET /actions/userCompletedCount/:id": () =>
      Response.json({
        completedCount: 0,
      } satisfies UserCompletedActionsCountDto),
    "POST /user/friends/:targetUserId": () =>
      Response.json({ message: "Already friends" }, { status: 409 }),
  }),
);

afterEach(cleanup);

const failStatus = () =>
  api.alsoServing({
    "GET /user/myfriendrelationship/:id": () =>
      Response.json({ message: "Internal server error" }, { status: 500 }),
  });

const renderProfile = () => {
  const { client, wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider value={authValue({ user: testAuthUser })}>
          <MemoryRouter initialEntries={[`/user/${GRACE.id}`]}>
            <Routes>
              <Route path="/user/:id" element={<UserProfilePage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
  return { client };
};

it("tells the user when the server refuses a friend request", async () => {
  renderProfile();
  fireEvent.click(await screen.findByText("Send friend request"));

  await screen.findByText("Couldn't send friend request");
  screen.getByText("Already friends");
});

it("offers a retry when the friend status fails to load", async () => {
  failStatus();
  renderProfile();
  const retry = await screen.findByTitle("Retry loading friend status");
  expect(screen.queryByText("Send friend request")).toBeNull();

  const retries: Pending<Response>[] = [];
  api.alsoServing({
    "GET /user/myfriendrelationship/:id": () => pending(retries),
  });
  fireEvent.click(retry);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(
    screen.getByTitle("Retry loading friend status").closest("button")
      ?.disabled,
  ).toBe(true);

  retries[0]?.resolve(
    Response.json({
      status: "none",
      didReceiveRequest: false,
    } satisfies FriendStatusDto),
  );
  await screen.findByText("Send friend request");
  expect(screen.queryByTitle("Retry loading friend status")).toBeNull();
});

it("leaves the count off the friends pill when friends fail to load", async () => {
  api.alsoServing({
    "GET /user/listfriends/:id": () =>
      Response.json({ message: "Internal server error" }, { status: 500 }),
    "GET /user/friends/requests/received": empty,
    "GET /user/friends/requests/sent": empty,
  });
  renderProfile();
  const pillLabel = (await screen.findAllByText("friends"))[0];
  fireEvent.click(pillLabel);

  await screen.findByText("Couldn't load this list.");
  expect(pillLabel.closest("div")?.textContent).not.toMatch(/\d/);
});

it("keeps a loaded friend status without a retry when a refetch fails", async () => {
  const { client } = renderProfile();
  await screen.findByText("Send friend request");

  failStatus();
  await act(() =>
    client.refetchQueries({ queryKey: userQueryKeys.friendStatus(GRACE.id) }),
  );
  // React Query tells the page about the failure on the next tick.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

  screen.getByText("Send friend request");
  expect(screen.queryByTitle("Retry loading friend status")).toBeNull();
});
