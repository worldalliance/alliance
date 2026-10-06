import type {
  CreateWaitlistEntryDto,
  WaitlistBrowserDto,
  WaitlistReferralDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
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

let referral: (url: URL) => Response;
let entry: (body: CreateWaitlistEntryDto) => Response | Promise<Response>;
let sent: CreateWaitlistEntryDto[];
let mailEnabled: boolean;

serveApi(
  routes({
    "GET /waitlist/referral": ({ request }) => referral(new URL(request.url)),
    "GET /waitlist/mail-config": () => Response.json({ enabled: mailEnabled }),
    "GET /waitlist/browser": () =>
      Response.json({ entry: null, inviteCode: null }),
    "POST /waitlist/entries": async ({ request }) => {
      const body: CreateWaitlistEntryDto = await request.json();
      sent.push(body);
      return entry(body);
    },
  }),
);

beforeEach(() => {
  sent = [];
  mailEnabled = false;
  referral = () => new Response(null, { status: 500 });
  entry = () => Response.json({ shareCode: "abc123" });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const organizationReferral = (entryCount: number): WaitlistReferralDto => ({
  organization: { name: "Acme Foundation", picture: null, entryCount },
  inviterName: null,
});

/** Starts from a browser that remembers nothing, so the form is usable at once. */
const renderForm = (search = "", client = new QueryClient()) => {
  client.setQueryData(queryKeys.waitlistBrowser(), {
    entry: null,
    inviteCode: null,
  } satisfies WaitlistBrowserDto);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[`/projects/democratic-grantmaking-26${search}`]}
      >
        <WaitlistSignupForm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const fill = ({ reason }: { reason?: string } = {}) => {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Test Person" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "person@example.com" },
  });
  if (reason !== undefined) {
    fireEvent.change(
      screen.getByLabelText("Why do you want to join the Alliance?"),
      { target: { value: reason } },
    );
  }
  fireEvent.click(
    screen.getByLabelText(
      "I understand that I'm joining the Alliance, which means weekly 15-minute projects.",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Join the Alliance waitlist/ }),
  );
};

test("asks a direct visitor why they want to join and shows their personal link", async () => {
  renderForm();

  fill({ reason: "I want to help" });

  await screen.findByText("You’re on the waitlist");
  expect(sent).toEqual([
    {
      name: "Test Person",
      email: "person@example.com",
      reason: "I want to help",
      committed: true,
    },
  ]);
  const link = screen.getByLabelText<HTMLInputElement>("Your personal link");
  expect(link.value).toMatch(
    /\/projects\/democratic-grantmaking-26\?ref=abc123$/,
  );
});

test("skips the reason for an organization link and names the organization", async () => {
  referral = (url) => {
    expect(url.searchParams.get("linkCode")).toBe("acme-news");
    return Response.json(organizationReferral(2));
  };
  renderForm("?link=acme-news");

  await screen.findByText("Acme Foundation");
  screen.getByText(/invited you to the Alliance/);
  expect(
    screen.queryByLabelText("Why do you want to join the Alliance?"),
  ).toBeNull();

  fill();
  await screen.findByText("You’re on the waitlist");
  expect(sent[0]).toMatchObject({ linkCode: "acme-news" });
  expect(sent[0].reason).toBeUndefined();
});

test("says it is checking the link while the lookup is out", async () => {
  referral = () => Response.json(organizationReferral(1));
  renderForm("?link=acme-news");

  screen.getByText("Checking your invitation link…");
  await screen.findByText("Acme Foundation");
  expect(screen.queryByText("Checking your invitation link…")).toBeNull();
});

test("shows an organization's logo only for its own link", async () => {
  const organization = {
    name: "Acme Foundation",
    picture: "http://api.test/images/acme.webp",
    entryCount: 1,
  };
  referral = (url) =>
    Response.json(
      url.searchParams.has("linkCode")
        ? { organization, inviterName: null }
        : { organization, inviterName: "Pat Inviter" },
    );
  const avatar = (container: HTMLElement) =>
    container.querySelector("form .group\\/avatar");

  const linked = renderForm("?link=acme-news");
  await screen.findByText("Acme Foundation");
  expect(avatar(linked.container)).not.toBeNull();
  linked.unmount();

  const personal = renderForm("?ref=friend");
  await screen.findByText("Pat Inviter");
  expect(avatar(personal.container)).toBeNull();
});

test("counts others from the organization once three have joined", async () => {
  referral = () => Response.json(organizationReferral(3));
  renderForm("?link=acme-news");

  await screen.findByText(/Join 3 others from/);
  expect(screen.queryByText(/invited you/)).toBeNull();
});

test("names the person behind a personal link and still asks an unaffiliated referral for a reason", async () => {
  referral = (url) => {
    expect(url.searchParams.get("referrerCode")).toBe("friend");
    return Response.json({ organization: null, inviterName: "Pat Inviter" });
  };
  renderForm("?ref=friend");

  await screen.findByText("Pat Inviter");
  fill({ reason: "Pat told me" });
  await screen.findByText("You’re on the waitlist");
  expect(sent[0]).toMatchObject({
    referrerCode: "friend",
    reason: "Pat told me",
  });
});

test("skips the reason for a personal link whose inviter has an organization", async () => {
  referral = () =>
    Response.json({
      organization: { name: "Acme Foundation", picture: null, entryCount: 1 },
      inviterName: "Pat Inviter",
    });
  renderForm("?ref=friend");

  await screen.findByText("Pat Inviter");
  expect(
    screen.queryByLabelText("Why do you want to join the Alliance?"),
  ).toBeNull();
  fill();
  await screen.findByText("You’re on the waitlist");
  expect(sent[0]).toMatchObject({ referrerCode: "friend" });
  expect(sent[0].reason).toBeUndefined();
});

test("stops at an inactive link until the visitor continues without it", async () => {
  referral = () =>
    Response.json({ statusCode: 404, message: "gone" }, { status: 404 });
  renderForm("?link=old");

  await screen.findByText("This invitation link is not active.");
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: /Join the Alliance waitlist/,
    }).disabled,
  ).toBe(true);

  fireEvent.click(
    screen.getByRole("button", { name: "Continue without this link" }),
  );
  fill({ reason: "Still interested" });
  await screen.findByText("You’re on the waitlist");
  expect(sent[0].linkCode).toBeUndefined();
});

test("tries a failed referral lookup again without dropping the link", async () => {
  let attempts = 0;
  referral = () =>
    ++attempts <= 2
      ? new Response(null, { status: 503 })
      : Response.json(organizationReferral(1));
  renderForm("?link=acme-news");

  await screen.findByText(
    "We couldn’t check this invitation link.",
    {},
    { timeout: 2500 },
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  await screen.findByText("Acme Foundation");
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: /Join the Alliance waitlist/,
    }).disabled,
  ).toBe(false);
});

test("keeps a checked link usable when a later refetch fails", async () => {
  const client = new QueryClient();
  referral = () => Response.json(organizationReferral(1));
  renderForm("?link=acme-news", client);
  await screen.findByText("Acme Foundation");

  referral = () => new Response(null, { status: 503 });
  const lookup = client
    .getQueryCache()
    .find({ queryKey: queryKeys.waitlistReferral({ linkCode: "acme-news" }) });
  void client.refetchQueries({ queryKey: lookup?.queryKey });
  await waitFor(() => expect(lookup?.state.status).toBe("error"), {
    timeout: 2500,
  });

  screen.getByText("Acme Foundation");
  expect(
    screen.queryByText("We couldn’t check this invitation link."),
  ).toBeNull();
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: /Join the Alliance waitlist/,
    }).disabled,
  ).toBe(false);
});

test("offers no retry for a lookup the server refused", async () => {
  referral = () =>
    Response.json({ statusCode: 400, message: "both" }, { status: 400 });
  renderForm("?link=acme-news&ref=friend");

  await screen.findByText("This invitation link is not active.");
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});

test("stops at a link that went inactive before the entry was sent", async () => {
  referral = () => Response.json(organizationReferral(1));
  entry = (body) =>
    body.linkCode
      ? Response.json({ statusCode: 404, message: "gone" }, { status: 404 })
      : Response.json({ shareCode: "abc123" });
  renderForm("?link=acme-news");
  await screen.findByText("Acme Foundation");

  fill();

  await screen.findByText("This invitation link is not active.");
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: /Join the Alliance waitlist/,
    }).disabled,
  ).toBe(true);

  fireEvent.click(
    screen.getByRole("button", { name: "Continue without this link" }),
  );
  fireEvent.change(
    await screen.findByLabelText("Why do you want to join the Alliance?"),
    { target: { value: "Still keen" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Join the Alliance waitlist/ }),
  );
  await screen.findByText("You’re on the waitlist");
  expect(sent[1].linkCode).toBeUndefined();
});

test("confirms a known email without revealing a link", async () => {
  entry = () => Response.json({ shareCode: null });
  renderForm();

  fill({ reason: "Again" });

  await screen.findByText("You’re on the waitlist");
  expect(screen.queryByLabelText("Your personal link")).toBeNull();
});

test("offers a known email its link by email while public email is on", async () => {
  mailEnabled = true;
  entry = () => Response.json({ shareCode: null });
  renderForm();

  fill({ reason: "Again" });

  await screen.findByRole("button", { name: /Email me my link/ });
});

test("offers no emailed link while public email is off", async () => {
  entry = () => Response.json({ shareCode: null });
  renderForm();

  fill({ reason: "Again" });

  await screen.findByText("You’re on the waitlist");
  expect(screen.queryByRole("button", { name: /Email me my link/ })).toBeNull();
});

test("keeps the answers and shows the refusal when the server rejects them", async () => {
  entry = () =>
    Response.json(
      { statusCode: 400, message: ["email must be an email"] },
      { status: 400 },
    );
  renderForm();

  fill({ reason: "Because" });

  await screen.findByText("email must be an email");
  expect(screen.getByLabelText<HTMLInputElement>("Full name").value).toBe(
    "Test Person",
  );
});

test("sends one entry however often the button is pressed", async () => {
  let release: () => void = () => {};
  entry = () =>
    new Promise((resolve) => {
      release = () => resolve(Response.json({ shareCode: "abc123" }));
    });
  renderForm();

  fill({ reason: "Eager" });
  const button = await screen.findByRole<HTMLButtonElement>("button", {
    name: /Joining/,
  });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);

  await waitFor(() => expect(sent).toHaveLength(1));
  release();
  await screen.findByText("You’re on the waitlist");
  expect(sent).toHaveLength(1);
});

test.each([
  [true, () => Promise.resolve()],
  [false, () => Promise.reject(new DOMException("denied"))],
])("copies the personal link (landed=%p)", async (landed, writeText) => {
  jest.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
  renderForm();
  fill({ reason: "Sharing" });
  const link =
    await screen.findByLabelText<HTMLInputElement>("Your personal link");

  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

  await waitFor(() =>
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link.value),
  );
  await waitFor(() =>
    expect(!!screen.queryByText(/Couldn’t copy the link/)).toBe(!landed),
  );
});
