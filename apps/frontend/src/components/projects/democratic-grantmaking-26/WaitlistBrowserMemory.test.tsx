import type { WaitlistBrowserDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { WaitlistSignupForm } from "./WaitlistSignupForm";

let browser: WaitlistBrowserDto;
let browserReply: () => Response | Promise<Response>;
let forgetReply: () => Response;
let forgotten: number;

serveApi(
  routes({
    "GET /waitlist/referral": () => new Response(null, { status: 500 }),
    "GET /waitlist/mail-config": () => Response.json({ enabled: true }),
    "GET /waitlist/browser": () => browserReply(),
    "DELETE /waitlist/browser": () => {
      forgotten += 1;
      return forgetReply();
    },
    "POST /waitlist/entries": () => {
      browser = {
        entry: { shareCode: "new123", mobilized: false },
        inviteCode: null,
      };
      return Response.json({ shareCode: "new123" });
    },
  }),
);

beforeEach(() => {
  browser = { entry: null, inviteCode: null };
  browserReply = () => Response.json(browser);
  forgetReply = () => new Response(null, { status: 204 });
  forgotten = 0;
});

afterEach(cleanup);

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/projects/democratic-grantmaking-26"]}>
        <WaitlistSignupForm />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const forgetButton = () =>
  screen.findByRole("button", { name: "Forget this browser" });

test("restores a remembered entry's link instead of the form", async () => {
  browser = {
    entry: { shareCode: "abc123", mobilized: false },
    inviteCode: null,
  };
  renderForm();

  await screen.findByDisplayValue(/ref=abc123$/);
  expect(screen.getByText("You’re on the waitlist.")).toBeTruthy();
  expect(screen.queryByLabelText("Email or mobile number")).toBeNull();
  expect(screen.queryByRole("button", { name: /Email me my link/ })).toBeNull();
});

test("tells a remembered mobilized entry it was invited, without an invite link", async () => {
  browser = {
    entry: { shareCode: "abc123", mobilized: true },
    inviteCode: null,
  };
  renderForm();

  await screen.findByText("You’re invited to join");
  screen.getByText("We sent you an invitation to join the Alliance.");
  expect(
    screen.queryByRole("link", { name: /Continue signing up/ }),
  ).toBeNull();
});

test("offers signup through a remembered invite", async () => {
  browser = { entry: null, inviteCode: "invite/1" };
  renderForm();

  const link = await screen.findByRole("link", { name: /Continue signing up/ });
  expect(link.getAttribute("href")).toBe("/signup?ref=invite%2F1");
  expect(screen.getByLabelText("Email or mobile number")).toBeTruthy();
});

test("forgets the browser and shows the form again", async () => {
  browser = {
    entry: { shareCode: "abc123", mobilized: false },
    inviteCode: "invite1",
  };
  renderForm();

  fireEvent.click(await forgetButton());

  await screen.findByLabelText("Email or mobile number");
  expect(forgotten).toBe(1);
  expect(
    screen.queryByRole("link", { name: /Continue signing up/ }),
  ).toBeNull();
});

test("keeps the remembered state and says so when forgetting fails", async () => {
  browser = {
    entry: { shareCode: "abc123", mobilized: false },
    inviteCode: null,
  };
  forgetReply = () => new Response(null, { status: 500 });
  renderForm();

  fireEvent.click(await forgetButton());

  await screen.findByText("We couldn’t forget this browser. Please try again.");
  expect(screen.getByLabelText("Your personal link")).toBeTruthy();
});

test("forgets a newly joined browser and hides its link", async () => {
  renderForm();
  await screen.findByLabelText("Email or mobile number");
  expect(
    screen.queryByRole("button", { name: "Forget this browser" }),
  ).toBeNull();

  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Test Person" },
  });
  fireEvent.change(screen.getByLabelText("Email or mobile number"), {
    target: { value: "person@example.com" },
  });
  fireEvent.change(
    screen.getByLabelText("Why do you want to join the Alliance?"),
    { target: { value: "To help" } },
  );
  fireEvent.click(
    screen.getByLabelText(
      "I understand that I'm joining the Alliance, which means weekly 15-minute projects.",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Join the Alliance waitlist/ }),
  );
  fireEvent.click(await forgetButton());

  const contact = await screen.findByLabelText<HTMLInputElement>(
    "Email or mobile number",
  );
  expect(contact.value).toBe("");
  expect(screen.queryByLabelText("Your personal link")).toBeNull();
});

test("holds the form until the browser state answers", async () => {
  let answer = () => {};
  browserReply = () =>
    new Promise((resolve) => {
      answer = () => resolve(Response.json(browser));
    });
  renderForm();

  expect(
    screen.getByLabelText("Email or mobile number").hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: /Join the Alliance waitlist/ })
      .hasAttribute("disabled"),
  ).toBe(true);

  answer();
  await waitFor(() =>
    expect(
      screen.getByLabelText("Email or mobile number").hasAttribute("disabled"),
    ).toBe(false),
  );
});

test("keeps the form usable when the browser state fails", async () => {
  browserReply = () => new Response(null, { status: 500 });
  renderForm();

  await waitFor(
    () =>
      expect(
        screen
          .getByLabelText("Email or mobile number")
          .hasAttribute("disabled"),
      ).toBe(false),
    { timeout: 3000 },
  );
});
