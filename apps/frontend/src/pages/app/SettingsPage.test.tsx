import { OAuthProvider } from "@alliance/common/oauth";
import { PHONE_NUMBER_TAKEN_FACT } from "@alliance/common/phone";
import type { City, UserDto } from "@alliance/shared/client";
import {
  makeCity,
  makeNotificationSettings,
} from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { meQuery, useMe } from "@alliance/shared/lib/useMe";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
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
let locationLoads = 0;
let locationFails = false;
let updates: unknown[] = [];
let savedZone = me.timeZone;
let notificationSettings = makeNotificationSettings();
let settingsUpdates: unknown[] = [];
let settingsSaveFails = false;
let takenNumber: string | null = null;
let served: UserDto = me;
let codeSends: string[] = [];

serveApi(
  routes({
    "GET /auth/me": () => {
      seedings += 1;
      if (meFails) {
        return Response.json({ message: "down" }, { status: 500 });
      }
      return Response.json({ user: { ...served, timeZone: savedZone } });
    },
    "GET /user/mylocation": () => {
      locationLoads += 1;
      if (locationFails) {
        return Response.json({ message: "down" }, { status: 500 });
      }
      return Response.json({ city });
    },
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
      const update = await request.json();
      updates.push(update);
      if (update.phoneNumber && update.phoneNumber === takenNumber) {
        return Response.json(
          { statusCode: 409, message: "Taken." },
          { status: 409 },
        );
      }
      if (update.cityId === null) city = null;
      if (update.phoneNumber && update.phoneNumber !== served.phoneNumber) {
        served = {
          ...served,
          phoneNumber: update.phoneNumber,
          phoneNumberVerified: false,
        };
      }
      return Response.json({ user: me });
    },
    "POST /user/phone/code": async ({ request }) => {
      codeSends.push((await request.json()).phoneNumber);
      return Response.json({
        challengeToken: "token",
        maskedDestination: "•••• 2671",
        resendAvailableAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
    },
    "POST /user/phone/code/verify": () => {
      served = {
        ...served,
        phoneNumber: codeSends.at(-1) ?? null,
        phoneNumberVerified: true,
      };
      notificationSettings = {
        ...notificationSettings,
        reachability: { textablePhoneNumber: true, textStopped: false },
      };
      return new Response(null, { status: 204 });
    },
  }),
);

afterEach(() => {
  seedings = 0;
  meFails = false;
  city = null;
  locationLoads = 0;
  locationFails = false;
  updates = [];
  savedZone = me.timeZone;
  notificationSettings = makeNotificationSettings();
  settingsUpdates = [];
  settingsSaveFails = false;
  takenNumber = null;
  served = me;
  codeSends = [];
});

const noop = () => Promise.resolve();

let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient();
});

const authFor = (
  user: UserDto | undefined,
  isImpersonation: boolean,
): AuthContextType => ({
  isAuthenticated: user !== undefined,
  user,
  isImpersonation,
  refreshUser: noop,
  login: noop,
  onLogin: noop,
  logout: noop,
  loading: false,
});

/** Reads the member from the cache, as the app's AuthProvider does. */
function LiveAuth({
  initial,
  children,
}: {
  initial: UserDto;
  children: ReactNode;
}) {
  const { me: loaded } = useMe();
  return (
    <AuthContext.Provider value={authFor(loaded?.user ?? initial, false)}>
      {children}
    </AuthContext.Provider>
  );
}

const settings = (
  user: UserDto | undefined,
  { isImpersonation = false, live = false } = {},
) => (
  <MemoryRouter initialEntries={["/settings"]}>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {live && user ? (
          <LiveAuth initial={user}>
            <SettingsPage />
          </LiveAuth>
        ) : (
          <AuthContext.Provider value={authFor(user, isImpersonation)}>
            <SettingsPage />
          </AuthContext.Provider>
        )}
      </ToastProvider>
    </QueryClientProvider>
  </MemoryRouter>
);

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

describe("the location", () => {
  beforeEach(() => {
    city = makeCity({ name: "Tucson" });
  });

  it("follows a saved custom city instead of the city the page opened with", async () => {
    render(settings(me));
    const input = await screen.findByPlaceholderText("Tucson");

    fireEvent.change(input, { target: { value: "Near the bay" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(input.getAttribute("placeholder")).toBe("Near the bay"),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({
        customCityString: "Near the bay",
        cityId: null,
      }),
    );
  });

  it("shows the form at once when the location fails to load", async () => {
    locationFails = true;
    render(settings(me));

    await screen.findByPlaceholderText("Enter phone number");
    expect(locationLoads).toBe(1);
  });
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

describe("confirming the phone number", () => {
  const unconfirmed: UserDto = {
    ...me,
    phoneNumber: "+14155550100",
    phoneNumberVerified: false,
  };

  beforeEach(() => {
    served = unconfirmed;
  });

  it("offers a code for a saved number no code has confirmed", async () => {
    render(settings(unconfirmed));

    expect(
      (await screen.findByText("Not confirmed")).closest('[role="status"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("textbox", { name: "Code" });
    expect(codeSends).toEqual(["+14155550100"]);
  });

  const confirm = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Code" }), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));
    await screen.findByText("Confirmed");
  };

  const savePhoneNumber = async (typed: string) => {
    const phoneNumber = screen.getByPlaceholderText("Enter phone number");
    fireEvent.focus(phoneNumber);
    fireEvent.change(phoneNumber, { target: { value: typed } });
    fireEvent.blur(phoneNumber);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
  };

  it("drops the note once confirmed, though reloading the member fails", async () => {
    render(settings(unconfirmed, { live: true }));
    await screen.findByText("Not confirmed");
    meFails = true;

    await confirm();
    expect(screen.queryByText("Not confirmed")).toBeNull();
  });

  it("says a confirmed number is unconfirmed again after switching away and back", async () => {
    render(settings(unconfirmed, { live: true }));
    await confirm();

    await savePhoneNumber("4155552671");
    await savePhoneNumber("4155550100");

    expect(served).toMatchObject({
      phoneNumber: "+14155550100",
      phoneNumberVerified: false,
    });
    expect(await screen.findByText("Not confirmed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send code" })).toBeTruthy();
  });

  it("is not offered while an admin impersonates the member", async () => {
    render(settings(unconfirmed, { isImpersonation: true }));

    await screen.findByPlaceholderText("Enter phone number");
    expect(screen.queryByRole("button", { name: "Send code" })).toBeNull();
  });

  it("keeps the server's refusal for an impersonating admin, who gets no code", async () => {
    takenNumber = "+14155552671";
    render(settings(unconfirmed, { isImpersonation: true }));

    const phoneNumber =
      await screen.findByPlaceholderText("Enter phone number");
    fireEvent.focus(phoneNumber);
    fireEvent.change(phoneNumber, { target: { value: "4155552671" } });
    fireEvent.blur(phoneNumber);

    expect(await screen.findByText("Taken.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send code" })).toBeNull();
  });

  it("offers the code for a number another account holds, and keeps it once confirmed", async () => {
    takenNumber = "+14155552671";
    notificationSettings = makeNotificationSettings({
      reachability: { textablePhoneNumber: false, textStopped: false },
    });
    render(settings(unconfirmed, { live: true }));

    const phoneNumber =
      await screen.findByPlaceholderText("Enter phone number");
    const regionsBefore = screen.getAllByRole("status");
    fireEvent.focus(phoneNumber);
    fireEvent.change(phoneNumber, { target: { value: "4155552671" } });
    fireEvent.blur(phoneNumber);

    const note = await screen.findByText(
      "Confirm it’s your number to move it to this account.",
    );
    expect(regionsBefore).toContain(note.closest('[role="status"]'));
    expect(screen.getByText(PHONE_NUMBER_TAKEN_FACT)).toBeTruthy();
    expect(screen.queryByText("Taken.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Code" }), {
      target: { value: "123456" },
    });
    const sentBefore = updates.length;
    fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));

    const status = await screen.findByText("Confirmed");
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(
      screen.queryByText(
        "Confirm it’s your number to move it to this account.",
      ),
    ).toBeNull();
    expect(codeSends).toEqual(["+14155552671"]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(updates.slice(sentBefore)).toEqual([]);
    expect(screen.queryByText(PHONE_NUMBER_TAKEN_FACT)).toBeNull();
    expect(screen.getByDisplayValue(/2671/)).toBeTruthy();
    expect(
      screen.queryByText(
        "Add a valid phone number to your profile to get texts.",
      ),
    ).toBeNull();
  });
});
