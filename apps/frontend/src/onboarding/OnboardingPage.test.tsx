import type { ContractDto, UserDto } from "@alliance/shared/client";
import { membershipAgreement } from "@alliance/shared/lib/copy";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as configModule from "@alliance/sharedweb/lib/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import * as ytEmbedModule from "../components/AllianceIntroYouTubeEmbed";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { InviteSessionProvider } from "../site/invite/InviteSession";
import * as landingBodyModule from "../site/sections/LandingBody";
import { testAuthUser } from "../stories/testData";
import OnboardingPage from "./OnboardingPage";
import * as onboardingPanelModule from "./OnboardingPanel";
import { OnboardingStep } from "./flow";

let contract: ContractDto | null;
let signRefusal: { status: number; message: string } | null;
let signUnreachable: boolean;

serveApi(
  routes({
    "GET /contract/current": () => Response.json(contract),
    "POST /auth/register": () => Response.json({}),
    "GET /auth/me": () => Response.json({ user: testAuthUser }),
    "POST /contract/sign/:id": () => {
      if (signUnreachable) throw new TypeError("Failed to fetch");
      return signRefusal === null
        ? Response.json({ date: "2026-03-10T12:00:00.000Z" })
        : Response.json(
            { statusCode: signRefusal.status, message: signRefusal.message },
            { status: signRefusal.status },
          );
    },
    "GET /user/referrerProfile/:code": () =>
      Response.json({
        kind: "user",
        displayName: "Inviter",
        profilePicture: null,
      }),
    "GET /user/onetimeInvite/:code": () => new Response(null, { status: 404 }),
    "POST /user/nmembers": () => Response.json({ count: 1000 }),
    "GET /user/slug/:id": () =>
      Response.json({ profilePicture: null, displayName: "" }),
    "GET /user/signupSocialProof": () => Response.json({ profiles: [] }),
  }),
);

/** The session the provider set by the time the page reads it. */
const member = (hasActiveContract: boolean): UserDto => ({
  ...testAuthUser,
  hasActiveContract,
});

beforeEach(() => {
  contract = null;
  signRefusal = null;
  signUnreachable = false;
  localStorage.clear();
  // The landing body's player reaches for a YouTube thumbnail on render.
  jest.spyOn(ytEmbedModule, "default").mockImplementation(() => <></>);
  // The OAuth return URL the account step builds needs a real origin.
  jest
    .spyOn(configModule, "getBaseUrl")
    .mockReturnValue("https://test.alliance");
});

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

const noop = () => Promise.resolve();

const authValue = (user: UserDto | undefined): AuthContextType => ({
  isAuthenticated: !!user,
  user,
  isImpersonation: false,
  refreshUser: noop,
  login: noop,
  onLogin: noop,
  logout: noop,
  loading: false,
});

const Search = () => (
  <>
    <div data-testid="search">{useLocation().search}</div>
    <div data-testid="pathname">{useLocation().pathname}</div>
  </>
);

const search = () => screen.getByTestId("search").textContent ?? "";

const pathname = () => screen.getByTestId("pathname").textContent ?? "";

const step = () => new URLSearchParams(search()).get("step");

// The OAuth return URL the account step builds needs a real origin.
window.happyDOM.setURL("https://test.alliance/onboarding");

/**
 * Returns a call that settles auth on the user it is given, keeping the page
 * mounted.
 */
const visit = (url: string, user?: UserDto, { authLoading = false } = {}) => {
  const queryClient = new QueryClient();
  const page = (pageUser: UserDto | undefined, loading: boolean) => (
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ ...authValue(pageUser), loading }}>
          <InviteSessionProvider>
            <OnboardingPage />
            <Search />
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  const { rerender } = render(page(user, authLoading));
  return (settled?: UserDto) => rerender(page(settled, false));
};

// The provider returns `linked` rather than `signed_up` whenever a user row
// already exists for the address, which is every invited member whose partial
// profile was pre-created.
test("a provider signup onto an existing record still enters the flow", async () => {
  visit("/onboarding?google=linked", member(false));

  await waitFor(() => expect(step()).toBe(OnboardingStep.Community));
});

test("a provider sign-in by someone who still owes the agreement enters the flow", async () => {
  visit("/onboarding?google=signed_in", member(false));

  await waitFor(() => expect(step()).toBe(OnboardingStep.Community));
});

test("a provider sign-in by a member who has entered it goes to the platform", async () => {
  visit("/onboarding?google=signed_in", member(true));

  await waitFor(() => expect(pathname()).toBe("/tasks"));
});

test("a provider signup walks on from the screen it lands on", async () => {
  visit("/onboarding?google=signed_up");

  await waitFor(() => expect(step()).toBe(OnboardingStep.Community));

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  // The whole search string: a spent notice carried forward replays the landing.
  await waitFor(() =>
    expect(search()).toBe(`?step=${OnboardingStep.Commitment}`),
  );
});

test("a provider return shows no sign-up screen while the session loads", () => {
  visit("/onboarding?google=signed_up", undefined, { authLoading: true });

  expect(
    screen.queryByRole("heading", { name: "Create an account" }),
  ).toBeNull();
  expect(localStorage.getItem("alliance:onboarding-draft")).toBeNull();
});

test("a provider return ignores a typed-email draft while the session loads", () => {
  localStorage.setItem(
    "alliance:onboarding-draft",
    JSON.stringify({
      email: "member@example.com",
      password: "",
      step: OnboardingStep.Account,
      referralCode: null,
      savedAt: Date.now(),
    }),
  );
  visit("/onboarding?google=signed_up", undefined, { authLoading: true });

  expect(
    screen.queryByRole("heading", { name: "Create an account" }),
  ).toBeNull();
  expect(step()).not.toBe(OnboardingStep.Account);
});

test("a provider sign-in by a member who has entered it shows no step on the way", () => {
  visit("/onboarding?google=signed_in", member(true), { authLoading: true });

  expect(screen.queryByText("What is the Alliance?")).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Create an account" }),
  ).toBeNull();
});

test("a provider return never shows Account once the session loads", () => {
  const landingBody = jest.spyOn(landingBodyModule, "LandingBody");
  const settleAuth = visit("/onboarding?google=signed_up", undefined, {
    authLoading: true,
  });
  settleAuth(member(false));

  expect(landingBody).not.toHaveBeenCalled();
});

test("a provider sign-in by a member who has entered it never shows a step", () => {
  const panel = jest.spyOn(onboardingPanelModule, "OnboardingPanel");
  const settleAuth = visit("/onboarding?google=signed_in", undefined, {
    authLoading: true,
  });
  settleAuth(member(true));

  expect(panel).not.toHaveBeenCalled();
});

test("a provider signup keeps its screen once the agreement is signed", async () => {
  const settleAuth = visit("/onboarding?google=signed_up", member(false));
  await waitFor(() => expect(step()).toBe(OnboardingStep.Community));

  settleAuth(member(true));

  expect(screen.getByText("What is the Alliance?")).toBeTruthy();
});

test("a member with an account keeps their place across a reload", async () => {
  visit(`/onboarding?step=${OnboardingStep.Minutes}`, testAuthUser);

  await waitFor(() => expect(step()).toBe(OnboardingStep.Minutes));
});

test("forgets the tab's invitation once signup has used it", async () => {
  sessionStorage.setItem(
    "alliance:invite",
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/onboarding?google=linked", member(false));

  await waitFor(() => expect(step()).toBe(OnboardingStep.Community));
  expect(sessionStorage.getItem("alliance:invite")).toBeNull();
});

test("forgets the tab's invitation once email signup has used it", async () => {
  contract = {
    id: 1,
    markdown: "",
    description: [{ point: "Act together", subtext: "" }],
  };
  sessionStorage.setItem(
    "alliance:invite",
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  localStorage.setItem(
    "alliance:onboarding-draft",
    JSON.stringify({
      email: "member@example.com",
      password: "a long password",
      step: OnboardingStep.Agreement,
      referralCode: null,
      savedAt: Date.now(),
    }),
  );
  visit(`/onboarding?step=${OnboardingStep.Agreement}`);

  fireEvent.change(await screen.findByLabelText("Sign your full name"), {
    target: { value: "Sam Member" },
  });
  expect(sessionStorage.getItem("alliance:invite")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Join" }));

  await waitFor(() =>
    expect(sessionStorage.getItem("alliance:invite")).toBeNull(),
  );
});

const failToSign = async (expected: string) => {
  contract = {
    id: 1,
    markdown: "",
    description: [{ point: "Act together", subtext: "" }],
  };
  visit(`/onboarding?step=${OnboardingStep.Agreement}`, member(false));

  fireEvent.change(await screen.findByLabelText("Sign your full name"), {
    target: { value: "Sam Member" },
  });
  const join = screen.getByRole("button", { name: "Join" });
  fireEvent.click(join);

  expect(await screen.findByText(expected)).toBeTruthy();
  await waitFor(() => expect(join.hasAttribute("disabled")).toBe(false));
};

test.each([
  [400, "Contract is outdated"],
  [401, membershipAgreement.signSessionExpired],
  [500, "We couldn’t record your agreement. Please try again."],
])(
  "shows a signature refused with %i as %j and lets the member try again",
  async (status, expected) => {
    signRefusal = { status, message: "Contract is outdated" };
    await failToSign(expected);
  },
);

test("lets the member try again when the agreement never reached the server", async () => {
  signUnreachable = true;
  await failToSign("We couldn’t record your agreement. Please try again.");
});

test("offers the tab's invitation on login", async () => {
  sessionStorage.setItem(
    "alliance:invite",
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/login");

  const accept = await screen.findByRole("link", { name: "Accept invite" });
  expect(accept.getAttribute("href")).toBe("/signup?ref=good");
});

test("offers no invitation on the signup it leads to", async () => {
  sessionStorage.setItem(
    "alliance:invite",
    JSON.stringify({ explicit: null, saved: "good" }),
  );
  visit("/signup?ref=good");

  await screen.findByRole("link", { name: /Log In/ });
  expect(screen.queryByRole("link", { name: "Accept invite" })).toBeNull();
});
