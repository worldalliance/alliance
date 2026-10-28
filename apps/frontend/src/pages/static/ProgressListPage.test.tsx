import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { InviteSessionProvider } from "../../site/invite/InviteSession";
import { authValue } from "../../testing/authValue";
import ProgressListPage from "./ProgressListPage";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter initialEntries={["/progress"]}>
          <InviteSessionProvider>
            <ProgressListPage />
          </InviteSessionProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

test("uses a light, narrower column and links only cards that have a page", () => {
  renderPage();

  const heading = screen.getByRole("heading", { level: 1, name: "Progress" });
  const header = heading.closest("header");
  expect(header?.className).toContain("bg-[var(--site-surface)]");
  expect(header?.className).not.toContain("--site-primary");
  expect(header?.firstElementChild?.className).toContain("max-w-7xl");
  expect(header?.firstElementChild?.className).not.toContain("max-w-[1750px]");

  const filter = screen.getByRole("group", { name: "Filter by priority" });
  expect(filter.parentElement?.className).toContain("max-w-7xl");

  const main = screen.getByRole("main");
  const links = within(main).getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/projects/plant-based-study",
  ]);
  expect(links[0]?.querySelector("svg")?.getAttribute("class")).toContain(
    "text-(--site-primary)",
  );

  const cafe = screen.getByText(/11 cafe locations/);
  expect(cafe.closest("a")).toBeNull();
});
