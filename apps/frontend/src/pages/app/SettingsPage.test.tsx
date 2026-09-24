import { OAuthProvider } from "@alliance/common/oauth";
import type { City, UserDto } from "@alliance/shared/client";
import { meQuery } from "@alliance/shared/lib/meQuery";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../../lib/AuthContext";
import { testAuthUser } from "../../stories/testData";
import SettingsPage from "./SettingsPage";

const me: UserDto = {
  ...testAuthUser,
  phoneNumber: null,
  oauthAccounts: [],
};
let seedings = 0;
let meFails = false;
let city: City | null = null;

serveApi(
  routes({
    "GET /auth/me": () => {
      seedings += 1;
      if (meFails) {
        return Response.json({ message: "down" }, { status: 500 });
      }
      return Response.json({ user: me });
    },
    "GET /user/mylocation": () => Response.json({ city }),
  }),
);

afterEach(() => {
  cleanup();
  seedings = 0;
  meFails = false;
  city = null;
});

const noop = () => Promise.resolve();

let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient();
});

const settings = (user: UserDto | undefined) => {
  const auth: AuthContextType = {
    isAuthenticated: user !== undefined,
    user,
    isImpersonation: false,
    refreshUser: noop,
    login: noop,
    onLogin: noop,
    logout: noop,
    loading: false,
  };
  return (
    <MemoryRouter initialEntries={["/settings"]}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthContext.Provider value={auth}>
            <SettingsPage />
          </AuthContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

it("keeps what the member typed when the auth user is refreshed", async () => {
  const { rerender } = render(settings(me));

  const phoneNumber = await screen.findByPlaceholderText("Enter phone number");
  fireEvent.focus(phoneNumber);
  fireEvent.change(phoneNumber, { target: { value: "415555" } });
  // A half-typed number is never sent, so the form is all that holds it.
  fireEvent.blur(phoneNumber);
  const typed = (phoneNumber as HTMLInputElement).value;
  expect(typed).toContain("415");

  rerender(settings({ ...me }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(
    (screen.getByPlaceholderText("Enter phone number") as HTMLInputElement)
      .value,
  ).toBe(typed);
  expect(seedings).toBe(1);
});

it("loads the profile once for the form and the connected accounts", async () => {
  render(settings(me));

  await screen.findByRole("button", { name: "Connect Google" });

  expect(seedings).toBe(1);
});

it("says the settings failed to load when the profile load fails", async () => {
  meFails = true;
  render(settings(me));

  expect(await screen.findByText("Couldn't load your settings.")).toBeTruthy();
});

it("does not say the settings failed to load on logout", async () => {
  const { rerender } = render(settings(me));
  await screen.findByPlaceholderText("Enter phone number");

  rerender(settings(undefined));

  expect(screen.queryByText("Couldn't load your settings.")).toBeNull();
});

it("doesn't show connections cached from an earlier visit when the profile load fails", async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(meQuery.queryKey, {
    ...me,
    oauthAccounts: [
      { provider: OAuthProvider.Google, email: "earlier@example.com" },
    ],
  });
  meFails = true;
  city = {
    id: 1,
    name: "Springfield",
    asciiName: "Springfield",
    englishName: null,
    admin1: "IL",
    admin2: "",
    countryCode: "US",
    countryName: "United States",
    latitude: 0,
    longitude: 0,
  };
  render(settings(me));

  expect(
    await screen.findByText("Couldn't load your connected accounts."),
  ).toBeTruthy();
  expect(screen.queryByText("earlier@example.com")).toBeNull();
});
