import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { authValue } from "../testing/authValue";
import { SiteFooter } from "./Footer";
import { InviteSessionProvider } from "./invite/InviteSession";

test("a collapsible footer starts as a strip and toggles open and shut", () => {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({})}>
          <InviteSessionProvider>
            <SiteFooter collapsible />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  expect(screen.queryByRole("navigation", { name: "Footer" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Show footer" }));
  expect(screen.getByRole("navigation", { name: "Footer" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show footer" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Hide footer" }));
  expect(screen.queryByRole("navigation", { name: "Footer" })).toBeNull();
});
