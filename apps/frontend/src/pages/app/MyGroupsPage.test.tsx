import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { IncomingCommunityInvitesProvider } from "@alliance/shared/lib/useIncomingCommunityInvites";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import MyGroupsPage from "./MyGroupsPage";

let myGroups = async () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

serveApi(
  routes({
    "GET /community/list/my": () => myGroups(),
    "GET /community/list/public": () => Response.json([]),
    "GET /community/communityInvites": () => Response.json([]),
  }),
);

afterEach(cleanup);

it("offers a retry instead of an empty group list when groups fail to load", async () => {
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider
          value={authValue({
            user: { ...testAuthUser, undergoingGroupAssignment: false },
          })}
        >
          <IncomingCommunityInvitesProvider>
            <MemoryRouter>
              <MyGroupsPage onSelectCommunity={() => {}} />
            </MemoryRouter>
          </IncomingCommunityInvitesProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
  await screen.findByText("Couldn't load your groups.");
  expect(screen.queryByText("Request assignment")).toBeNull();

  const { promise, resolve } = Promise.withResolvers<Response>();
  myGroups = () => promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() =>
    expect(screen.getByText("Try again").closest("button")?.disabled).toBe(
      true,
    ),
  );
  expect(screen.queryByText("Request assignment")).toBeNull();

  resolve(Response.json([]));
  await screen.findByText("Request assignment");
  expect(screen.queryByText("Couldn't load your groups.")).toBeNull();
});
