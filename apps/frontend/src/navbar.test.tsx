import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import NavbarTopBar from "./components/NavbarTopBar";
import { AuthContext } from "./lib/AuthContext";
import {
  ImmersiveTone,
  NavbarOptionsContext,
} from "./lib/NavbarOptionsContext";
import { NavbarMain } from "./navbar";
import { testAuthUser } from "./stories/testData";
import { authValue } from "./testing/authValue";

serveApi(
  routes({
    "GET /notifs": () => Response.json([]),
    "GET /notifs/unread-count": () => Response.json({ unreadCount: 0 }),
  }),
);

function renderChrome({ immersive }: { immersive: boolean }) {
  const { wrapper: Queries } = queryWrapper();
  render(
    <Queries>
      <MemoryRouter>
        <AuthContext.Provider value={authValue({ user: testAuthUser })}>
          <NavbarOptionsContext.Provider
            value={{
              options: { immersive, immersiveTone: ImmersiveTone.Plain },
              setOptions: () => {},
            }}
          >
            <NavbarTopBar />
            <NavbarMain>
              <p>Page</p>
            </NavbarMain>
          </NavbarOptionsContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </Queries>,
  );
}

const inertOf = (element: HTMLElement) => element.closest("[inert]") !== null;

it.each([true, false])(
  "inerts the page, search and notifications only while immersive (%s)",
  (immersive) => {
    renderChrome({ immersive });
    expect(inertOf(screen.getByRole("main"))).toBe(immersive);
    expect(inertOf(screen.getByRole("button", { name: "Search" }))).toBe(
      immersive,
    );
    const bell = document.querySelector<HTMLElement>(".lucide-bell");
    if (!bell) throw new Error("no notifications icon");
    expect(inertOf(bell)).toBe(immersive);
  },
);

it.each([true, false])(
  "opens search from Cmd+K only while not immersive (%s)",
  (immersive) => {
    renderChrome({ immersive });
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(
      screen.queryByRole("button", { name: "Close search" }) === null,
    ).toBe(immersive);
  },
);
