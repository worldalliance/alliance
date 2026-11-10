import { KORA_PROJECT_PATH, KoraProjectStatus } from "@alliance/common/kora";
import type { KoraParticipantDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { testAuthUser } from "../../../stories/testData";
import { authValue } from "../../../testing/authValue";
import SaferChatbotsForChildren26 from "./SaferChatbotsForChildren26";

declare const happyDOM: { setURL: (url: string) => void };

let participant: KoraParticipantDto | null = null;
let status = KoraProjectStatus.Pending;
let projectFails = false;

serveApi(
  routes({
    "GET /kora/me": () =>
      Response.json({ participant, pendingCode: null, signupPending: false }),
    "GET /kora/participants/count": () => Response.json({ count: 123 }),
    "POST /kora/sign-out": () => new Response(null, { status: 204 }),
    "GET /kora/project": () =>
      projectFails
        ? new Response(null, { status: 500 })
        : Response.json({ status }),
  }),
);

beforeEach(() => {
  happyDOM.setURL(`https://worldalliance.org${KORA_PROJECT_PATH}`);
  status = KoraProjectStatus.Pending;
  projectFails = false;
});

const renderPage = (member: Parameters<typeof authValue>[0] = {}) =>
  render(
    <MemoryRouter initialEntries={[KORA_PROJECT_PATH]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue(member)}>
          <InviteSessionProvider>
            <SaferChatbotsForChildren26 />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

const h1 = () => screen.getByRole("heading", { level: 1 }).textContent;

test("shows neither page until the participant check answers", async () => {
  participant = null;
  renderPage();

  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  await screen.findByRole("button", { name: "Continue" });
});

test("shows a visitor who hasn't signed up the sign-up page", async () => {
  participant = null;
  renderPage();

  await screen.findByRole("button", { name: "Continue" });
  expect(h1()).toBe("Make AI chatbots safer for kids");
});

test("counts Kora participants, not Alliance members, toward the goal", async () => {
  participant = null;
  renderPage();

  await screen.findByText("123 participants");
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

test("a participant signs out back to the sign-up page", async () => {
  participant = { id: "p1", name: "Test Person" };
  renderPage();

  await screen.findByText("You’re signed in as Test Person.");
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("button", { name: "Continue" });
  expect(h1()).toBe("Make AI chatbots safer for kids");
});

test("welcomes a signed-in member, with their tasks and profile in the bar", async () => {
  participant = null;
  renderPage({ user: testAuthUser });

  await screen.findByRole("heading", {
    level: 1,
    name: "Alliance members will help shape how children interact with AI chatbots",
  });
  expect(screen.getByRole("link", { name: /My tasks/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Go to profile" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
});

const CLOSED = "The project has closed. Thank you to everyone who took part.";

test("closes sign-up for a visitor once the project has closed", async () => {
  participant = null;
  status = KoraProjectStatus.Closed;
  renderPage();

  await screen.findByText(CLOSED);
  expect(h1()).toBe("Make AI chatbots safer for kids");
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
});

test("thanks a participant once the project has closed, keeping sign-out", async () => {
  participant = { id: "p1", name: "Test Person" };
  status = KoraProjectStatus.Closed;
  renderPage();

  await screen.findByRole("heading", {
    level: 1,
    name: "Thank you for taking part",
  });
  expect(screen.getByText(CLOSED)).toBeTruthy();
  expect(screen.queryByText("Reviews start on November 17th.")).toBeNull();
  expect(screen.queryByRole("switch", { name: "Remind me" })).toBeNull();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
});

test("thanks a member once the project has closed", async () => {
  participant = null;
  status = KoraProjectStatus.Closed;
  renderPage({ user: testAuthUser });

  await screen.findByText(CLOSED);
  expect(h1()).toBe("Thank you for taking part");
});

test("shows the waitlist while the project is active", async () => {
  participant = { id: "p1", name: "Test Person" };
  status = KoraProjectStatus.Active;
  renderPage();

  await screen.findByRole("heading", {
    level: 1,
    name: "Thank you for joining the waitlist",
  });
  expect(screen.queryByText(CLOSED)).toBeNull();
});

test("says so when the project status can't load", async () => {
  participant = null;
  projectFails = true;
  renderPage();

  const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
  expect(alert.textContent).toBe(
    "Couldn't load the project. Reload to try again.",
  );
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
});
