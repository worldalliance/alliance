import type {
  FriendStatusDto,
  ProfileDto,
  UserCompletedActionsCountDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

serveApi(
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

it("tells the user when the server refuses a friend request", async () => {
  const { wrapper: QueryWrapper } = queryWrapper();
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
  fireEvent.click(await screen.findByText("Send friend request"));

  await screen.findByText("Couldn't send friend request");
  screen.getByText("Already friends");
});
