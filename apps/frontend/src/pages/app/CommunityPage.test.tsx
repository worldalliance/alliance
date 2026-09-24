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
import CommunityPage from "./CommunityPage";

let myGroups: () => Promise<Response>;

serveApi(
  routes({
    "GET /community/list/my": () => myGroups(),
    "GET /community/list/public": () => Response.json([]),
    "GET /community/communityInvites": () => Response.json([]),
  }),
);

afterEach(cleanup);

const isDisabled = (text: string) =>
  screen.getByText(text).closest("button")?.disabled;

const renderPage = () => {
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
              <CommunityPage />
            </MemoryRouter>
          </IncomingCommunityInvitesProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
};

it("offers no group assignment until your groups load", async () => {
  const { promise, resolve } = Promise.withResolvers<Response>();
  myGroups = () => promise;
  renderPage();
  await screen.findByRole("status");
  expect(screen.queryByText("Request assignment")).toBeNull();

  resolve(Response.json([]));
  await screen.findByText("Request assignment");
});

it("keeps the retry on screen while retrying a failed load of your groups", async () => {
  myGroups = async () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  renderPage();
  await screen.findByText("Couldn't load your groups.");
  // MyGroupsPage mounting refetches the failed query; let that settle first.
  await waitFor(() => expect(isDisabled("Try again")).toBe(false));

  const { promise, resolve } = Promise.withResolvers<Response>();
  myGroups = () => promise;
  fireEvent.click(screen.getByText("Try again"));

  await waitFor(() => expect(isDisabled("Try again")).toBe(true));
  expect(screen.getByText("Couldn't load your groups.")).toBeTruthy();

  resolve(Response.json([]));
  await screen.findByText("Request assignment");
});
