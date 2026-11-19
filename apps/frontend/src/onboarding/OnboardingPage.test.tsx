import type { ContractDto, UserDto } from "@alliance/shared/client";
import { membershipAgreement } from "@alliance/shared/lib/copy";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as configModule from "@alliance/sharedweb/lib/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import * as ytEmbedModule from "../components/AllianceIntroYouTubeEmbed";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { InviteSessionProvider } from "../site/invite/InviteSession";
import * as landingBodyModule from "../site/sections/LandingBody";
import { testAuthUser } from "../stories/testData";
import OnboardingPage from "./OnboardingPage";
import * as onboardingPanelModule from "./OnboardingPanel";
import { PHONE_HEADLINE, PHONE_REFUSED, PHONE_SKIP_LABEL } from "./PhoneStep";
import { isPhoneStepDeferred, OnboardingStep, phoneStepHref } from "./flow";
import { walkthroughStartHref } from "./walkthrough/steps";

let contract: ContractDto | null;
let signRefusal: { status: number; message: string } | null;
let signUnreachable: boolean;
let profileUpdates: unknown[];
let profileUnreachable: boolean;
let profileRefusal: { status: number; message: string } | null;
let signatures: number;

serveApi(
  routes({
    "GET /contract/current": () => Response.json(contract),
    "POST /auth/register": () => Response.json({}),
    "GET /auth/me": () => Response.json({ user: testAuthUser }),
    "POST /contract/sign/:id": () => {
      signatures += 1;
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
    "POST /user/update": async ({ request }) => {
      if (profileUnreachable) throw new TypeError("Failed to fetch");
      if (profileRefusal) {
        return Response.json(
          {
            statusCode: profileRefusal.status,
            message: profileRefusal.message,
          },
          { status: profileRefusal.status },
        );
      }
      profileUpdates.push(await request.json());
      return Response.json(testAuthUser);
    },
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
  profileUpdates = [];
  profileUnreachable = false;
  profileRefusal = null;
  signatures = 0;
  localStorage.clear();
  sessionStorage.clear();
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
const visit = (
  url: string,
  user?: UserDto,
  {
    authLoading = false,
    logout = noop,
  }: { authLoading?: boolean; logout?: () => Promise<void> } = {},
) => {
  const queryClient = new QueryClient();
  const page = (pageUser: UserDto | undefined, loading: boolean) => (
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{ ...authValue(pageUser), loading, logout }}
        >
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

test("a provider sign-in sends a member to no other site", async () => {
  visit(
    "/onboarding?google=signed_in&redirect=//elsewhere.example",
    member(true),
  );

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

const agreement: ContractDto = {
  id: 1,
  markdown: "",
  description: [{ point: "Act together", subtext: "" }],
};

test("forgets the tab's invitation once email signup has used it", async () => {
  contract = agreement;
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
  contract = agreement;
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

const joinToPhoneStep = async () => {
  contract = agreement;
  visit(`/onboarding?step=${OnboardingStep.Agreement}`, member(false));
  fireEvent.change(await screen.findByLabelText("Sign your full name"), {
    target: { value: "Sam Member" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await screen.findByText(PHONE_HEADLINE);
  expect(step()).toBe(OnboardingStep.Phone);
};

test("asks for a phone number after the agreement, and saves it before entering the platform", async () => {
  await joinToPhoneStep();

  const getStarted = screen.getByRole<HTMLButtonElement>("button", {
    name: /Get started/,
  });
  expect(getStarted.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "415" },
  });
  expect(getStarted.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "4155552671" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Get started/ }));

  await waitFor(() =>
    expect(`${pathname()}${search()}`).toBe(walkthroughStartHref()),
  );
  expect(profileUpdates).toEqual([{ phoneNumber: "+14155552671" }]);
});

test("returns a member the platform sent to the phone step to the page they opened", async () => {
  contract = agreement;
  visit(phoneStepHref("/actions/5?tab=1"), member(true));
  fireEvent.change(await screen.findByLabelText("Phone number"), {
    target: { value: "4155552671" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Get started/ }));

  await waitFor(() => expect(pathname()).toBe("/actions/5"));
  expect(search()).toBe("?tab=1");
});

test("offers a way to log out only to a member the platform sent to the phone step", async () => {
  contract = agreement;
  const logout = jest.fn(noop);
  visit(phoneStepHref("/tasks"), member(true), { logout });
  fireEvent.click(await screen.findByRole("button", { name: "Log out" }));
  expect(logout).toHaveBeenCalledTimes(1);
});

test("offers no way to log out during signup", async () => {
  await joinToPhoneStep();
  expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
});

test("lets a member the platform sent to the phone step in without a number for the visit once theirs is refused", async () => {
  contract = agreement;
  profileRefusal = { status: 409, message: "Taken" };
  visit(phoneStepHref("/actions/5"), member(true));
  fireEvent.change(await screen.findByLabelText("Phone number"), {
    target: { value: "4155552671" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
  fireEvent.click(
    await screen.findByRole("button", { name: new RegExp(PHONE_SKIP_LABEL) }),
  );

  await waitFor(() => expect(pathname()).toBe("/actions/5"));
  expect(isPhoneStepDeferred(testAuthUser.id)).toBe(true);
});

test("keeps a member the platform sent to the phone step there over a stale signup draft", async () => {
  localStorage.setItem(
    "alliance:onboarding-draft",
    JSON.stringify({
      email: "member@example.com",
      password: "a long password",
      step: OnboardingStep.Account,
      referralCode: null,
      savedAt: Date.now(),
    }),
  );
  contract = agreement;
  const settleAuth = visit(phoneStepHref("/tasks"), undefined, {
    authLoading: true,
  });
  settleAuth(member(true));

  await screen.findByText(PHONE_HEADLINE);
  expect(step()).toBe(OnboardingStep.Phone);
});

test("resumes a signed-out visitor's draft without waiting for the session", () => {
  localStorage.setItem(
    "alliance:onboarding-draft",
    JSON.stringify({
      email: "member@example.com",
      password: "a long password",
      step: OnboardingStep.Minutes,
      referralCode: null,
      savedAt: Date.now(),
    }),
  );
  visit("/onboarding", undefined, { authLoading: true });

  expect(step()).toBe(OnboardingStep.Minutes);
});

test("gives a member who left at the phone step the first-task tour once the platform sends them back", async () => {
  await joinToPhoneStep();
  cleanup();

  visit(phoneStepHref("/tasks"), member(true));
  fireEvent.change(await screen.findByLabelText("Phone number"), {
    target: { value: "4155552671" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Get started/ }));

  await waitFor(() =>
    expect(`${pathname()}${search()}`).toBe(walkthroughStartHref()),
  );
});

test("goes back from the phone step to the signed agreement without signing it again", async () => {
  await joinToPhoneStep();

  fireEvent.click(screen.getByRole("button", { name: /Back/ }));
  await waitFor(() => expect(step()).toBe(OnboardingStep.Agreement));
  expect(
    screen.getByLabelText<HTMLInputElement>("Sign your full name").readOnly,
  ).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  await screen.findByText(PHONE_HEADLINE);
  expect(step()).toBe(OnboardingStep.Phone);
  expect(signatures).toBe(1);
});

test("keeps the agreement signed after a reload on the phone step", async () => {
  contract = agreement;
  visit(`/onboarding?step=${OnboardingStep.Phone}`, member(true));
  await screen.findByText(PHONE_HEADLINE);

  fireEvent.click(screen.getByRole("button", { name: /Back/ }));
  await waitFor(() => expect(step()).toBe(OnboardingStep.Agreement));
  expect(screen.getByText("Agreement received")).toBeTruthy();
  expect(screen.queryByLabelText("Sign your full name")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  await screen.findByText(PHONE_HEADLINE);
  expect(signatures).toBe(0);
});

test("lets the member try another number when the phone number never reached the server", async () => {
  await joinToPhoneStep();
  profileUnreachable = true;

  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "4155552671" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Get started/ }));

  expect(await screen.findByText(PHONE_REFUSED)).toBeTruthy();
  expect(step()).toBe(OnboardingStep.Phone);

  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "4155552672" },
  });
  expect(screen.queryByText(PHONE_REFUSED)).toBeNull();
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: /Get started/ })
      .disabled,
  ).toBe(false);
});

test("lets the member continue without a number once the server refuses theirs", async () => {
  await joinToPhoneStep();
  profileRefusal = {
    status: 409,
    message:
      "This phone number is already linked to an account. Enter a different number.",
  };

  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "4155552671" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Get started/ }));

  expect(await screen.findByText(PHONE_REFUSED)).toBeTruthy();
  fireEvent.click(
    await screen.findByRole("button", { name: new RegExp(PHONE_SKIP_LABEL) }),
  );

  await waitFor(() =>
    expect(`${pathname()}${search()}`).toBe(walkthroughStartHref()),
  );
  expect(profileUpdates).toEqual([]);
});
