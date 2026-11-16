import { KORA_EXAMPLE_PATH, KORA_PROJECT_PATH } from "@alliance/common/kora";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { authValue } from "../../../testing/authValue";
import { EXAMPLE_COPY } from "./copy";
import KoraExamplePage from "./KoraExamplePage";
import { EXAMPLE_OPENED_KEY } from "./KoraHomeBase";

serveApi(
  routes({
    "GET /kora/me": () =>
      Response.json({
        participant: null,
        pendingCode: null,
        signupPending: false,
      }),
  }),
);

beforeEach(() => localStorage.clear());

test("mounts the example pair under a banner, and remembers it was opened", async () => {
  const { container } = render(
    <MemoryRouter initialEntries={[KORA_EXAMPLE_PATH]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({})}>
          <InviteSessionProvider>
            <KoraExamplePage />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText(EXAMPLE_COPY.banner)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: EXAMPLE_COPY.back }).getAttribute("href"),
  ).toBe(KORA_PROJECT_PATH);
  await waitFor(() =>
    expect(container.textContent).toContain(
      "You have 1 pair of conversations to review.",
    ),
  );
  expect(localStorage.getItem(EXAMPLE_OPENED_KEY)).toBe("true");
});
