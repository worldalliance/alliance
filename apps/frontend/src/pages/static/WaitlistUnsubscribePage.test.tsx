import type { WaitlistUnsubscribeDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { InviteSessionProvider } from "../../site/invite/InviteSession";
import { authValue } from "../../testing/authValue";
import WaitlistUnsubscribePage from "./WaitlistUnsubscribePage";

let requested: WaitlistUnsubscribeDto[];
let reply: () => Response;

serveApi(
  routes({
    "POST /waitlist/unsubscribe": async ({ request }) => {
      requested.push(await request.json());
      return reply();
    },
  }),
);

beforeEach(() => {
  requested = [];
  reply = () => new Response(null, { status: 204 });
});

afterEach(cleanup);

const renderPage = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter initialEntries={[url]}>
          <InviteSessionProvider>
            <WaitlistUnsubscribePage />
          </InviteSessionProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

const TOKEN = "00000000-0000-4000-8000-000000000000";
const PAGE = `/waitlist/unsubscribe?token=${TOKEN}`;

const unsubscribeButton = () =>
  screen.getByRole("button", { name: "Unsubscribe" });

test("unsubscribes only once the visitor confirms", async () => {
  renderPage(PAGE);
  expect(requested).toEqual([]);

  fireEvent.click(unsubscribeButton());

  await screen.findByText(/You’re unsubscribed/);
  expect(requested).toEqual([{ token: TOKEN }]);
});

test("shows a refusal and lets the visitor try again", async () => {
  reply = () =>
    Response.json({ statusCode: 500, message: "Oops" }, { status: 500 });
  renderPage(PAGE);

  fireEvent.click(unsubscribeButton());
  await screen.findByText("We couldn’t unsubscribe you. Please try again.");

  reply = () => new Response(null, { status: 204 });
  fireEvent.click(unsubscribeButton());
  await screen.findByText(/You’re unsubscribed/);
});

test.each([
  ["has no code", "/waitlist/unsubscribe"],
  ["has a malformed code", "/waitlist/unsubscribe?token=abc"],
])(
  "calls a link that %s invalid, without offering to unsubscribe",
  (_, url) => {
    renderPage(url);

    screen.getByText("This unsubscribe link is not valid.");
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
  },
);

test("calls a link whose code the server doesn't know invalid, without a retry", async () => {
  reply = () =>
    Response.json(
      { statusCode: 404, message: "This unsubscribe link is not valid" },
      { status: 404 },
    );
  renderPage(PAGE);

  fireEvent.click(unsubscribeButton());

  await screen.findByText("This unsubscribe link is not valid.");
  expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
});
