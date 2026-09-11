import type { UserDto } from "@alliance/shared/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { OnboardingStep } from "./flow";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

// The landing body's player reaches for a YouTube thumbnail on render.
jest.mock("react-player", () => ({ default: () => null }));

jest.mock("@alliance/sharedweb/lib/config", () => ({
  getBaseUrl: () => "https://test.alliance",
  getApiUrl: () => "https://test.alliance/api",
  getWebSocketUrl: () => "https://test.alliance",
  isProduction: () => false,
  isStaging: () => false,
}));

jest.mock("@alliance/shared/client", () => ({
  authForgotPassword: async () => ({ error: undefined }),
  authLogin: async () => ({ error: undefined }),
  authMe: async () => ({ data: undefined }),
  authRegister: async () => ({ response: { ok: true } }),
  contractGetCurrent: async () => ({ data: null }),
  contractSignContract: async () => ({ response: { ok: true } }),
  userNmembers: async () => ({ data: { count: 1000 } }),
  userOnetimeInvite: async () => ({ data: null }),
  userReferrerProfile: async () => ({ data: null }),
  userSignupSocialProof: async () => ({ data: { profiles: [] } }),
}));

// Imported after the mocks: its imports bind to the real modules otherwise.
const { default: OnboardingPage } = await import("./OnboardingPage");

// Auto-cleanup registers once, in whichever file imports the library first.
afterEach(cleanup);

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

const Search = () => <div data-testid="search">{useLocation().search}</div>;

const search = () => screen.getByTestId("search").textContent ?? "";

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
