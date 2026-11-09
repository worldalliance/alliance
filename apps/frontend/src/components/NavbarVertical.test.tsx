import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import {
  ImmersiveTone,
  NavbarOptionsContext,
} from "../lib/NavbarOptionsContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import NavbarVertical from "./NavbarVertical";

declare const happyDOM: { setURL: (url: string) => void };

afterEach(() => happyDOM.setURL("about:blank"));

serveApi(
  routes({
    "GET /community/communityInvites": () => Response.json([]),
    "GET /messaging/conversations/unread-summary": () =>
      Response.json({ totalCount: 0 }),
  }),
);

function renderNav({
  immersive,
  user = testAuthUser,
  path = "/",
}: {
  immersive: boolean;
  user?: typeof testAuthUser;
  path?: string;
}) {
  const { wrapper: Queries } = queryWrapper();
  render(
    <Queries>
      <MemoryRouter initialEntries={[path]}>
        <AuthContext.Provider value={authValue({ user })}>
          <NavbarOptionsContext.Provider
            value={{
              options: { immersive, immersiveTone: ImmersiveTone.Plain },
              setOptions: () => {},
            }}
          >
            <NavbarVertical
              todoActions={3}
              mobileNavOpen={false}
              onMobileNavOpenChange={() => {}}
            />
          </NavbarOptionsContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </Queries>,
  );
}

it("keeps the task count in the collapsed rail's title and accessible name", () => {
  renderNav({ immersive: true });
  const tasks = screen.getByTitle("Tasks (3)");
  expect(within(tasks).getAllByText("3")).toHaveLength(2);
});

it("puts no title on the expanded nav, keeping the count in the link text", () => {
  renderNav({ immersive: false });
  expect(screen.queryByTitle(/^Tasks/)).toBeNull();
  expect(screen.getByRole("link", { name: /Tasks/ }).textContent).toContain(
    "3",
  );
});

it("links admins to the admin panel's counterpart of the current page", () => {
  happyDOM.setURL("https://worldalliance.org/");
  renderNav({
    immersive: false,
    user: { ...testAuthUser, admin: true },
    path: "/feed/12",
  });
  expect(
    screen
      .getByRole("link", { name: "Open in admin panel" })
      .getAttribute("href"),
  ).toBe("https://admin.worldalliance.org/actions/12");
  expect(
    screen
      .getByRole("link", { name: "Open in admin panel" })
      .getAttribute("title"),
  ).toBe("Open in admin panel");
});

it("shows members no admin panel link", () => {
  renderNav({ immersive: false });
  expect(
    screen.queryByRole("link", { name: "Open in admin panel" }),
  ).toBeNull();
});
