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
import { ALLIANCE_BLURB } from "./KoraNavbar";
import SaferChatbotsForChildren26 from "./SaferChatbotsForChildren26";

declare const happyDOM: { setURL: (url: string) => void };

let participant: KoraParticipantDto | null = null;
let status = KoraProjectStatus.Pending;
let projectFails = false;
let signOutFails = false;

const PARTICIPANT: KoraParticipantDto = {
  id: "p1",
  name: "Test Person",
  maskedContact: "•••0042",
};

serveApi(
  routes({
    "GET /kora/me": () =>
      Response.json({ participant, pendingCode: null, signupPending: false }),
    "GET /kora/participants/count": () => Response.json({ count: 123 }),
    "POST /kora/sign-out": () =>
      new Response(null, { status: signOutFails ? 500 : 204 }),
    "GET /kora/review/home": () =>
      Response.json({
        totalRanked: 0,
        userBatches: [
          {
            id: null,
            status: "ready",
            releasedAt: "2026-11-17T10:00:00.000Z",
            closesAt: null,
            progress: 0,
            total: 10,
          },
        ],
      }),
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
  signOutFails = false;
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
  participant = PARTICIPANT;
  renderPage();

  await screen.findByRole("heading", {
    level: 1,
    name: "Thank you for joining the waitlist",
  });
  expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
});

const openAccountMenu = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Test Person" }));
  await screen.findByText("Signed in as •••0042");
};

test("shows a participant a menu with their name in place of Log In", async () => {
  participant = PARTICIPANT;
  renderPage();

  await openAccountMenu();
  expect(screen.queryByRole("link", { name: /Log In/ })).toBeNull();
  expect(screen.queryByText(/signed in as Test Person/i)).toBeNull();
});

test("a participant signs out from the menu back to the sign-up page", async () => {
  participant = PARTICIPANT;
  renderPage();

  await openAccountMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  await screen.findByRole("button", { name: "Continue" });
  expect(h1()).toBe("Make AI chatbots safer for kids");
});

test("keeps the menu open with an error when sign-out fails", async () => {
  participant = PARTICIPANT;
  signOutFails = true;
  renderPage();

  await openAccountMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  await screen.findByText("Something went wrong. Please try again.");
  expect(screen.getByText("Signed in as •••0042")).toBeTruthy();
});

test("opens a blurb about the Alliance from the logotype", async () => {
  participant = null;
  renderPage();
  await screen.findByRole("button", { name: "Continue" });

  fireEvent.click(screen.getByRole("button", { name: "The Alliance" }));
  await screen.findByText(ALLIANCE_BLURB);
  expect(
    screen
      .getByRole("link", { name: "Learn more about the Alliance" })
      .getAttribute("href"),
  ).toBe("/");
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

test("lets a returning participant sign in under the closed thank-you", async () => {
  participant = null;
  status = KoraProjectStatus.Closed;
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", {
      name: "Already taking part? Sign in to finish your reviews",
    }),
  );
  await screen.findByRole("button", { name: "Continue" });
  expect(screen.getByText(CLOSED)).toBeTruthy();
});

test("thanks a participant once the project has closed, keeping sign-out", async () => {
  participant = PARTICIPANT;
  status = KoraProjectStatus.Closed;
  renderPage();

  await screen.findByRole("heading", {
    level: 1,
    name: "Thank you for taking part",
  });
  expect(screen.getByText(CLOSED)).toBeTruthy();
  expect(screen.queryByText("Reviews start on November 17th.")).toBeNull();
  expect(screen.queryByRole("switch", { name: "Remind me" })).toBeNull();
  expect(screen.getByRole("button", { name: "Test Person" })).toBeTruthy();
});

test("thanks a member once the project has closed", async () => {
  participant = null;
  status = KoraProjectStatus.Closed;
  renderPage({ user: testAuthUser });

  await screen.findByText(CLOSED);
  expect(h1()).toBe("Thank you for taking part");
});

test("shows a signed-in participant their home base once the project is active", async () => {
  participant = PARTICIPANT;
  status = KoraProjectStatus.Active;
  renderPage();

  await screen.findByRole("heading", { level: 1, name: "Rank 10 pairs" });
  expect(screen.queryByText("Thank you for joining the waitlist")).toBeNull();
  expect(screen.queryByText(/KoraBench/)).toBeNull();
  expect(screen.queryByRole("switch", { name: "Remind me" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Choose a category" })).toBeNull();
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
