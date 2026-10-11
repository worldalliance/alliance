import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import MembersListPage from "./MembersListPage";

let members: () => Response;

serveApi(
  routes({
    "GET /user/membersWithFriends": () => members(),
    "GET /user/friends/requests/sent": () => Response.json([]),
    "GET /user/listfriends/:id": () => Response.json([]),
  }),
);

beforeEach(() => {
  members = () => Response.json([{ ...makeProfile(2), friendIds: [] }]);
});

afterEach(cleanup);

const renderPage = () => {
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <AuthContext.Provider value={authValue({ user: testAuthUser })}>
        <MemoryRouter>
          <MembersListPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryWrapper>,
  );
};

it("lists the members", async () => {
  renderPage();

  await screen.findByText("User 2");
});

it("says the members failed to load instead of listing none", async () => {
  members = () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  renderPage();

  await screen.findByText("Could not load members");
  expect(screen.queryByText("None found")).toBeNull();
});
