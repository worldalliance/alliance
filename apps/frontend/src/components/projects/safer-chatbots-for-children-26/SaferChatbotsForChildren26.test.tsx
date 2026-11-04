import { KORA_PROJECT_PATH } from "@alliance/common/kora";
import type { KoraParticipantDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { authValue } from "../../../testing/authValue";
import SaferChatbotsForChildren26 from "./SaferChatbotsForChildren26";

declare const happyDOM: { setURL: (url: string) => void };

let participant: KoraParticipantDto | null = null;

serveApi(
  routes({
    "GET /kora/me": () =>
      Response.json({ participant, pendingCode: null, signupPending: false }),
    "POST /user/nmembers": () => Response.json({ count: 1000 }),
  }),
);

beforeEach(() =>
  happyDOM.setURL(`https://worldalliance.org${KORA_PROJECT_PATH}`),
);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[KORA_PROJECT_PATH]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({})}>
          <InviteSessionProvider>
            <SaferChatbotsForChildren26 />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

const h1 = () => screen.getByRole("heading", { level: 1 }).textContent;

test("shows a visitor who hasn't signed up the sign-up page", async () => {
  participant = null;
  renderPage();

  await screen.findByRole("button", { name: "Continue" });
  expect(h1()).toBe("Make AI chatbots safer for kids");
});

test("welcomes a participant", async () => {
  participant = { id: "p1", name: "Test Person" };
  renderPage();

  await screen.findByRole("heading", {
    level: 1,
    name: "Thank you for joining the waitlist",
  });
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
});
