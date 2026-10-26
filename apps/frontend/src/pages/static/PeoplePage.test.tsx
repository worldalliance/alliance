import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { InviteSessionProvider } from "../../site/invite/InviteSession";
import { authValue } from "../../testing/authValue";
import PeoplePage from "./PeoplePage";

let count: number;

serveApi(
  routes({
    "POST /user/nmembers": () => Response.json({ count }),
    "GET /user/members-public": () => Response.json([]),
    "GET /user/staff-directory": () => Response.json([]),
  }),
);

const visit = () => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue({})}>
        <InviteSessionProvider>
          <PeoplePage />
        </InviteSessionProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
    { wrapper },
  );
};

it("states the member count", async () => {
  count = 1234;
  visit();
  expect(
    await screen.findByText(/^The Alliance has 1234 members\./),
  ).toBeTruthy();
});

it("states a single member in the singular", async () => {
  count = 1;
  visit();
  expect(await screen.findByText(/^The Alliance has 1 member\./)).toBeTruthy();
});
