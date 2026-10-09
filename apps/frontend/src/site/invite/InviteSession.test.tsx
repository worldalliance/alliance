import type { UserDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useInvite } from "@alliance/shared/lib/useInvite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import { SiteFooter } from "../Footer";
import { JoinCta } from "../JoinCta";
import { Navbar } from "../Navbar";
import { InviteSessionProvider, useInviteSession } from "./InviteSession";

const KEY = "alliance:invite";

type Reply = () => Response | Promise<Response>;

const found = () =>
  Response.json({ kind: "user", displayName: "Inviter", profilePicture: null });
const missing = () => new Response(null, { status: 404 });
const usedInvite = () =>
  Response.json({
    id: 1,
    invitee: "Sam",
    code: "used",
    createdAt: new Date().toISOString(),
    status: "link_used",
    invitedUserId: 2,
    accepted: true,
  });

let referrers: Record<string, Reply>;
let invites: Record<string, Reply>;

serveApi(
  routes({
    "GET /user/referrerProfile/:code": ({ params }) =>
      (referrers[decodeURIComponent(params.code)] ?? missing)(),
    "GET /user/onetimeInvite/:code": ({ params }) =>
      (invites[decodeURIComponent(params.code)] ?? missing)(),
  }),
);

beforeEach(() => {
  sessionStorage.clear();
  referrers = { good: found, other: found, "a b": found };
  invites = { used: usedInvite };
});

afterEach(() => {
  cleanup();
  unblock();
});

function Where() {
  const location = useLocation();
  return (
    <output aria-label="url">{location.pathname + location.search}</output>
  );
}

const visit = (url: string, user?: UserDto) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({ user })}>
          <InviteSessionProvider>
            <Navbar />
            <Link to="/guide">Go to guide</Link>
            <JoinCta />
            <SiteFooter />
            <Where />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

const acceptLink = async () =>
  (await screen.findAllByRole("link", { name: "Accept invite" }))[0];
const forgetButton = () =>
  screen.getAllByRole("button", { name: "Forget invitation" })[0];
let unblock = () => {};
const blockStorage = (...methods: ("getItem" | "setItem" | "removeItem")[]) => {
  const real = window.sessionStorage;
  const blocked = new Proxy(real, {
    get: (target, prop) => {
      if (methods.some((method) => method === prop)) {
        return () => {
          throw new Error("blocked");
        };
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  Object.defineProperty(window, "sessionStorage", {
    value: blocked,
    configurable: true,
  });
  unblock = () =>
    Object.defineProperty(window, "sessionStorage", {
      value: real,
      configurable: true,
    });
};
const stored = () => JSON.parse(sessionStorage.getItem(KEY) ?? "null");

test("carries a scanned code from the homepage through navigation", async () => {
  visit("/?ref=a%20b");

  await acceptLink();
  expect(
    screen
      .getAllByRole("link", { name: "Accept invite" })
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/signup?ref=a%20b", "/signup?ref=a%20b"]);
  expect(screen.getByRole("link", { name: "Join" }).getAttribute("href")).toBe(
    "/signup?ref=a%20b",
  );

  fireEvent.click(screen.getByRole("link", { name: "Go to guide" }));
  await screen.findByText("/guide", { selector: "output" });
  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=a%20b");
  await waitFor(() =>
    expect(stored()).toEqual({ explicit: null, saved: "a b" }),
  );
});

test("restores the tab's saved invitation on a page without a code", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/guide");

  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=good");
});

test("offers the waitlist to a fresh tab with no code", async () => {
  visit("/guide");

  const join = await screen.findByRole("link", { name: "Join" });
  await waitFor(() =>
    expect(join.getAttribute("href")).toBe(
      "/projects/democratic-grantmaking-26",
    ),
  );
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
});

test("lets a valid explicit code replace the saved one", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/?ref=other");

  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=other");
  await waitFor(() =>
    expect(stored()).toEqual({ explicit: null, saved: "other" }),
  );
});

test("suppresses the saved code behind an unavailable explicit one, through navigation", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/?ref=used");

  await screen.findByText("This invitation is no longer available.");
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
  await waitFor(() =>
    expect(stored()).toEqual({ explicit: "used", saved: "good" }),
  );

  fireEvent.click(screen.getByRole("link", { name: "Go to guide" }));
  await screen.findByText("/guide", { selector: "output" });
  expect(
    screen.getByText("This invitation is no longer available."),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
});

test("dismissing an unavailable explicit code brings back the saved one", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/?ref=used");
  await screen.findByText("This invitation is no longer available.");

  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

  await screen.findByText("/", { selector: "output" });
  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=good");
  expect(
    screen.queryByText("This invitation is no longer available."),
  ).toBeNull();
  expect(stored()).toEqual({ explicit: null, saved: "good" });
});

test("keeps the saved code when storage refuses a dismiss", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/?ref=used");
  await screen.findByText("This invitation is no longer available.");
  blockStorage("setItem");

  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=good");
  expect(screen.queryByText(/reloading may bring it back/)).toBeNull();
});

test("never shows the saved code while an explicit one is being checked", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  let answer = () => {};
  referrers.slow = () =>
    new Promise((resolve) => {
      answer = () => resolve(found());
    });
  visit("/?ref=slow");

  await waitFor(() => expect(stored()?.explicit).toBe("slow"));
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();

  act(() => answer());
  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=slow");
});

test("keeps Log In usable while a saved code is still being checked", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "hang" }),
  );
  referrers.hang = () => new Promise(() => {});
  invites.hang = () => new Promise(() => {});
  visit("/guide");

  const logIn = await screen.findByRole("link", { name: /Log In/ });
  expect(logIn.closest('[aria-hidden="true"]')).toBeNull();
  expect(logIn.className).not.toContain("max-[560px]:hidden");
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
});

test("clears a saved code that is no longer available", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "used" }),
  );
  visit("/guide");

  await screen.findByText("This invitation is no longer available.");
  await waitFor(() =>
    expect(stored()).toEqual({ explicit: "used", saved: null }),
  );
});

test("keeps a code it could not check and still passes it to signup", async () => {
  referrers.flaky = () => new Response(null, { status: 503 });
  invites.flaky = () => new Response(null, { status: 503 });
  visit("/?ref=flaky");

  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=flaky");
  expect(
    screen.queryByText("This invitation is no longer available."),
  ).toBeNull();
  await waitFor(() =>
    expect(stored()).toEqual({ explicit: "flaky", saved: null }),
  );
});

test("carries the code in memory when sessionStorage is blocked", async () => {
  blockStorage("setItem");
  visit("/?ref=good");

  await acceptLink();
  fireEvent.click(screen.getByRole("link", { name: "Go to guide" }));
  await screen.findByText("/guide", { selector: "output" });
  expect((await acceptLink()).getAttribute("href")).toBe("/signup?ref=good");
  expect(sessionStorage.getItem(KEY)).toBeNull();
});

test("forgets the invitation and drops ref from the URL, keeping other params", async () => {
  visit("/?utm=x&ref=good");
  await acceptLink();

  fireEvent.click(forgetButton());

  await screen.findByText("/?utm=x", { selector: "output" });
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
  expect(sessionStorage.getItem(KEY)).toBeNull();
});

test("sends a visitor who forgets on the invite page to the homepage", async () => {
  visit("/invite?utm=x&ref=good");
  await acceptLink();

  fireEvent.click(forgetButton());

  await screen.findByText("/?utm=x", { selector: "output" });
  expect(sessionStorage.getItem(KEY)).toBeNull();
});

test("clears without refetching the lookups signup is still showing", async () => {
  let lookups = 0;
  invites.good = () => {
    lookups += 1;
    return missing();
  };
  function UseAndClear() {
    const { clear } = useInviteSession();
    const { inviter } = useInvite("good");
    return (
      <button type="button" onClick={clear}>
        {inviter ? "Clear" : "Loading"}
      </button>
    );
  }
  render(
    <MemoryRouter initialEntries={["/signup?ref=good"]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({})}>
          <InviteSessionProvider>
            <UseAndClear />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Clear" }));

  await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
  expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  expect(lookups).toBe(1);
});

test("leaves ref alone on a page that reads its own", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/actions/12?ref=share");
  await acceptLink();

  fireEvent.click(forgetButton());

  await waitFor(() =>
    expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull(),
  );
  expect(screen.getByText("/actions/12?ref=share", { selector: "output" }));
  expect(sessionStorage.getItem(KEY)).toBeNull();
});

test("says so, and retries, when the tab cannot drop the stored invitation", async () => {
  visit("/?ref=good");
  await acceptLink();
  blockStorage("removeItem");

  fireEvent.click(forgetButton());

  await screen.findByText(/reloading may bring it back/);
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();

  unblock();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(screen.queryByText(/reloading may bring it back/)).toBeNull(),
  );
  expect(sessionStorage.getItem(KEY)).toBeNull();
});

test("forgets quietly when storage is blocked entirely, since nothing was kept", async () => {
  blockStorage("getItem", "setItem", "removeItem");
  visit("/?ref=good");
  await acceptLink();

  fireEvent.click(forgetButton());

  await waitFor(() =>
    expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull(),
  );
  expect(screen.queryByText(/reloading may bring it back/)).toBeNull();
});

test("shows no clear failure to a visitor who just signed up", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  blockStorage("removeItem");
  function Clear() {
    const { clear } = useInviteSession();
    return (
      <button type="button" onClick={clear}>
        Clear
      </button>
    );
  }
  render(
    <MemoryRouter initialEntries={["/"]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({ user: testAuthUser })}>
          <InviteSessionProvider>
            <Navbar />
            <Clear />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Clear" }));

  await screen.findByRole("link", { name: /My tasks/ });
  expect(screen.queryByText(/reloading may bring it back/)).toBeNull();
});

test("leaves the tab's invitation alone for a signed-in visitor", async () => {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/?ref=other", testAuthUser);

  await screen.findByRole("link", { name: /My tasks/ });
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
  expect(stored()).toEqual({ explicit: null, saved: "good" });
});

test("does not capture a code while authentication is loading", async () => {
  render(
    <MemoryRouter initialEntries={["/?ref=good"]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({ loading: true })}>
          <InviteSessionProvider>
            <Navbar />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

  await act(async () => {});
  expect(sessionStorage.getItem(KEY)).toBeNull();
});

test("ignores ref on pages that read their own", async () => {
  visit("/actions/12?ref=good");

  await screen.findByRole("link", { name: "Join" });
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
  expect(sessionStorage.getItem(KEY)).toBeNull();
});
