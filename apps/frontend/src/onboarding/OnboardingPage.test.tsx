import type { UserDto } from "@alliance/shared/client";
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
import { testAuthUser } from "../stories/testData";
import OnboardingPage from "./OnboardingPage";
import { OnboardingStep } from "./flow";

serveApi(
  routes({
    "GET /contract/current": () => Response.json(null),
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
  // The landing body's player reaches for a YouTube thumbnail on render.
  jest.spyOn(ytEmbedModule, "default").mockImplementation(() => <></>);
  // The OAuth return URL the account step builds needs a real origin.
  jest
    .spyOn(configModule, "getBaseUrl")
    .mockReturnValue("https://test.alliance");
});

// Auto-cleanup registers once, in whichever file imports the library first.
afterEach(cleanup);

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

const visit = (url: string, user?: UserDto) => {
  render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue(user)}>
          <OnboardingPage />
          <Search />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
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

test("a member with an account keeps their place across a reload", async () => {
  visit(`/onboarding?step=${OnboardingStep.Minutes}`, testAuthUser);

  await waitFor(() => expect(step()).toBe(OnboardingStep.Minutes));
});
