import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { authValue } from "../testing/authValue";
import { InviteSessionProvider } from "./invite/InviteSession";
import { Navbar } from "./Navbar";

const renderNavbar = (hideNavLinks: boolean) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({})}>
          <InviteSessionProvider>
            <Navbar hideNavLinks={hideNavLinks} />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

test("hideNavLinks drops the People, Guide, Progress and Partner links and the menu", () => {
  renderNavbar(true);
  expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Guide" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Partner" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
});

test("the navbar shows its primary links by default", () => {
  renderNavbar(false);
  expect(screen.getByRole("link", { name: "Guide" })).toBeTruthy();
});
