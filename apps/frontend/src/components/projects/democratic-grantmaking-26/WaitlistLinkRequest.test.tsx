import type { WaitlistLinkRequestDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WaitlistLinkRequest } from "./WaitlistLinkRequest";

let requested: WaitlistLinkRequestDto[];
let reply: () => Response;

serveApi(
  routes({
    "POST /waitlist/link-requests": async ({ request }) => {
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

const renderRequest = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WaitlistLinkRequest email="person@example.com" />
    </QueryClientProvider>,
  );

const emailButton = () =>
  screen.getByRole("button", { name: /Email me my link/ });

test("requests the link for the entered email", async () => {
  renderRequest();

  fireEvent.click(emailButton());

  await screen.findByText(/Check person@example.com for your personal link/);
  expect(requested).toEqual([{ email: "person@example.com" }]);
});

test("shows a refusal and lets the visitor try again", async () => {
  reply = () =>
    Response.json(
      { statusCode: 400, message: ["email must be an email"] },
      { status: 400 },
    );
  renderRequest();

  fireEvent.click(emailButton());
  await screen.findByText("email must be an email");

  reply = () => new Response(null, { status: 204 });
  fireEvent.click(emailButton());
  await screen.findByText(/Check person@example.com/);
  expect(requested).toHaveLength(2);
});
