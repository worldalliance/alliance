import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  FEED_EMPTY_MESSAGE,
  FeedMode,
} from "@alliance/shared/lib/useActivityFeeds";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import ActionActivityFeedPage from "./ActionActivityFeedPage";

let action: () => Response;

serveApi(
  routes({
    "GET /actions/slug/:id": () => action(),
    "GET /actions/:id/activities": () => Response.json([]),
    "GET /user/listfriends/:id": () => Response.json([]),
  }),
);

const renderPage = () => {
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <AuthContext.Provider value={authValue({ user: testAuthUser })}>
        <MemoryRouter initialEntries={["/feed/7"]}>
          <Routes>
            <Route
              path="/feed/:actionId"
              element={<ActionActivityFeedPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryWrapper>,
  );
};

it("heads the feed with the action's name", async () => {
  action = () => Response.json(makeAction({ id: 7, name: "Plant a tree" }));
  renderPage();

  await screen.findByText("Plant a tree");
});

it("leaves the heading off when the action fails to load", async () => {
  action = () => Response.json({ message: "Not Found" }, { status: 404 });
  renderPage();

  await screen.findByText(FEED_EMPTY_MESSAGE[FeedMode.Everyone]);
  expect(screen.queryByText("Back to action")).toBeNull();
});
