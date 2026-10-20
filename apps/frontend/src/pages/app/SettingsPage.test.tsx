import { OAuthProvider } from "@alliance/common/oauth";
import type { City, UserDto } from "@alliance/shared/client";
import { makeNotificationSettings } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { meQuery } from "@alliance/shared/lib/useMe";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
let updates: unknown[] = [];
let savedZone = me.timeZone;
let notificationSettings = makeNotificationSettings();
let settingsUpdates: unknown[] = [];
let settingsSaveFails = false;

serveApi(
  routes({
    "GET /auth/me": () => {
      seedings += 1;
      if (meFails) {
        return Response.json({ message: "down" }, { status: 500 });
      }
      return Response.json({ user: { ...me, timeZone: savedZone } });
    },
    "GET /user/mylocation": () => Response.json({ city }),
    "GET /user/notification-settings": () =>
      Response.json(notificationSettings),
    "PATCH /user/notification-settings": async ({ request }) => {
      settingsUpdates.push(await request.json());
      if (settingsSaveFails) {
        settingsSaveFails = false;
        return Response.json({ message: "down" }, { status: 500 });
      }
      return Response.json(notificationSettings);
    },
    "POST /user/update": async ({ request }) => {
      updates.push(await request.json());
      return Response.json({ user: me });
    },
  }),
);

afterEach(() => {
  cleanup();
  seedings = 0;
  meFails = false;
  city = null;
  updates = [];
  savedZone = me.timeZone;
  notificationSettings = makeNotificationSettings();
  settingsUpdates = [];
  settingsSaveFails = false;
});

const noop = () => Promise.resolve();

let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient();
});

const settings = (
  user: UserDto | undefined,
  { isImpersonation = false } = {},
) => {
  const auth: AuthContextType = {
    isAuthenticated: user !== undefined,
    user,
    isImpersonation,
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
    user: {
      ...me,
      oauthAccounts: [
        { provider: OAuthProvider.Google, email: "earlier@example.com" },
      ],
    },
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

describe("the device timezone", () => {
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const elsewhere =
    device === "Pacific/Kiritimati"
      ? "Pacific/Pago_Pago"
      : "Pacific/Kiritimati";

  it("is offered when the saved zone differs, and Use saves it", async () => {
    savedZone = elsewhere;
    render(settings(me));

    await screen.findByText(/^Device timezone: /);
    fireEvent.click(screen.getByRole("button", { name: "Use" }));

    await waitFor(() => expect(updates).toEqual([{ timeZone: device }]));
    expect(screen.queryByText(/^Device timezone: /)).toBeNull();
  });

  it("is not offered when the saved zone is the device's", async () => {
    savedZone = device;
    render(settings(me));

    await screen.findByPlaceholderText("Enter phone number");

    expect(screen.queryByText(/^Device timezone: /)).toBeNull();
  });

  it("is not offered while an admin impersonates the member", async () => {
    savedZone = elsewhere;
    render(settings(me, { isImpersonation: true }));

    await screen.findByPlaceholderText("Enter phone number");

    expect(screen.queryByText(/^Device timezone: /)).toBeNull();
  });
});

describe("notification defaults", () => {
  it("saves a channel default as it changes", async () => {
    render(settings(me));

    const push = await screen.findByRole("group", { name: "Push by default" });
    fireEvent.click(within(push).getByRole("button", { name: "Off" }));

    await waitFor(() =>
      expect(settingsUpdates).toEqual([{ defaults: { push: false } }]),
    );
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("offers to try a failed save again", async () => {
    settingsSaveFails = true;
    render(settings(me));

    const push = await screen.findByRole("group", { name: "Push by default" });
    fireEvent.click(within(push).getByRole("button", { name: "Off" }));
    const tryAgain = await screen.findByRole("button", { name: "Try again" });
    expect(
      within(push).getByRole("button", { name: "Off", pressed: true }),
    ).toBeTruthy();
    fireEvent.click(tryAgain);

    expect(await screen.findByText("Saved")).toBeTruthy();
    expect(settingsUpdates).toEqual([
      { defaults: { push: false } },
      { defaults: { push: false } },
    ]);
  });

  it("warns when no channel sends anything, and counts own settings", async () => {
    notificationSettings = makeNotificationSettings({
      defaults: { inApp: false, push: false, text: false, email: false },
    });
    notificationSettings.kinds[0].cells[1].override = false;
    render(settings(me));

    expect(
      await screen.findByText(/You will not receive any notifications/),
    ).toBeTruthy();
    expect(
      screen.getByText("1 notification has its own setting for Push"),
    ).toBeTruthy();
  });

  it("says when texts can't reach the member, apart from the setting", async () => {
    notificationSettings = makeNotificationSettings({
      reachability: { textablePhoneNumber: true, textStopped: true },
    });
    render(settings(me));

    expect(
      await screen.findByText(
        "You replied STOP to our texts. Reply START to get them again.",
      ),
    ).toBeTruthy();
  });

  it("links only to sections the member has kinds in", async () => {
    render(settings(me));

    expect(
      await screen.findByRole("link", { name: "Friends & likes" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Groups" })).toBeNull();
  });
});
