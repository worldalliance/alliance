import { OAuthProvider } from "@alliance/common/oauth";
import type { UserDto } from "@alliance/shared/client";
import type { SettingsSaveStatus } from "@alliance/shared/lib/settings";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { MemoryRouter } from "react-router";
import AccountSettings from "./AccountSettings";

declare const happyDOM: { setURL: (url: string) => void };

const google = { provider: OAuthProvider.Google, email: "g@example.com" };
const apple = { provider: OAuthProvider.Apple, email: "a@privaterelay.com" };

let me: UserDto;
let meFails: boolean;
let unlinked: string[];
let unlinkRefusal: string | null;
let resetEmails: unknown[];
let resetFails: boolean;
let refreshStatus: number;
let journey: string[];

serveApi(
  routes({
    "GET /auth/me": () =>
      meFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json({ user: me }),
    "DELETE /auth/:provider/link": ({ params }) => {
      if (unlinkRefusal) {
        return Response.json(
          { statusCode: 409, message: unlinkRefusal },
          { status: 409 },
        );
      }
      unlinked.push(params.provider);
      me = {
        ...me,
        oauthAccounts: me.oauthAccounts?.filter(
          (account) => account.provider !== params.provider,
        ),
      };
      return Response.json({ user: me });
    },
    "POST /auth/refresh": () => {
      journey.push("refresh");
      return Response.json({}, { status: refreshStatus });
    },
    "POST /auth/forgot-password": async ({ request }) => {
      resetEmails.push(await request.json());
      return resetFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json({});
    },
  }),
);

let assign: ReturnType<typeof spyOn>;

beforeEach(() => {
  happyDOM.setURL("https://worldalliance.org/settings");
  me = makeUser({ email: "ada@example.com", oauthAccounts: [google] });
  meFails = false;
  unlinked = [];
  unlinkRefusal = null;
  resetEmails = [];
  resetFails = false;
  refreshStatus = 200;
  journey = [];
  assign = spyOn(window.location, "assign").mockImplementation(() => {
    journey.push("assign");
  });
});

afterEach(() => {
  cleanup();
  assign.mockRestore();
});

const account = (params: {
  saveStatus?: SettingsSaveStatus;
  entry?: string;
  queryClient?: QueryClient;
  impersonating?: boolean;
}) => (
  <MemoryRouter initialEntries={[params.entry ?? "/settings"]}>
    <QueryClientProvider
      client={
        params.queryClient ??
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <AccountSettings
          email="ada@example.com"
          saveStatus={params.saveStatus ?? "saved"}
          impersonating={params.impersonating ?? false}
        />
      </ToastProvider>
    </QueryClientProvider>
  </MemoryRouter>
);

const button = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

it("offers each provider's action and the password action that fits", async () => {
  me = makeUser({ hasPassword: false, oauthAccounts: [google] });
  render(account({}));

  expect(await screen.findByText("g@example.com")).toBeTruthy();
  expect(button("Set password").disabled).toBe(false);
  expect(button("Disconnect Google").disabled).toBe(true);
  expect(screen.getByText(/Google is your only way to log in/)).toBeTruthy();
  expect(button("Connect Apple").disabled).toBe(false);
});

it("holds every connection control while an admin impersonates", async () => {
  render(account({ impersonating: true }));
  await screen.findByText("g@example.com");

  expect(button("Disconnect Google").disabled).toBe(true);
  expect(button("Connect Apple").disabled).toBe(true);
  expect(screen.getByText(/can't be changed while impersonating/)).toBeTruthy();
});

it("disconnects only once the member confirms", async () => {
  me = makeUser({ oauthAccounts: [google, apple] });
  render(account({}));
  await screen.findByText("g@example.com");

  const row = button("Disconnect Google");
  fireEvent.click(row);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(unlinked).toEqual([]);

  await waitFor(() => expect(row.disabled).toBe(false));
  fireEvent.click(row);
  const confirmed = await waitFor(() => {
    const found = screen
      .getAllByRole("button", { name: "Disconnect Google" })
      .find((candidate) => candidate !== row);
    if (!found) {
      throw new Error("no confirm button yet");
    }
    return found;
  });
  fireEvent.click(confirmed);

  expect(await screen.findByText("Google disconnected.")).toBeTruthy();
  expect(unlinked).toEqual([OAuthProvider.Google]);
  expect(screen.queryByText("g@example.com")).toBeNull();
});

it("holds Connect while a disconnect waits on its confirm", async () => {
  render(account({}));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Disconnect Google"));
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  expect(button("Connect Apple").disabled).toBe(true);

  fireEvent.click(cancel);
  await waitFor(() => expect(button("Connect Apple").disabled).toBe(false));
});

it("says why the server refused a disconnect", async () => {
  me = makeUser({ oauthAccounts: [google, apple] });
  unlinkRefusal = "Google is the only way into your account.";
  render(account({}));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Disconnect Google"));
  const disconnects = () =>
    screen.getAllByRole("button", { name: "Disconnect Google" });
  await waitFor(() => expect(disconnects()).toHaveLength(2));
  fireEvent.click(disconnects()[1]);

  expect(
    await screen.findByText("Google is the only way into your account."),
  ).toBeTruthy();
});

it("shows no connection actions when the accounts fail to load", async () => {
  meFails = true;
  render(account({}));

  expect(
    await screen.findByText("Couldn't load your connected accounts."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Connect/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Disconnect/ })).toBeNull();
  expect(button("Reset password").disabled).toBe(false);
});

it("sends the password email and says where it went", async () => {
  render(account({}));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Reset password"));

  expect(
    await screen.findByText(
      "A link to reset your password has been sent to ada@example.com.",
    ),
  ).toBeTruthy();
  expect(resetEmails).toEqual([{ email: "ada@example.com" }]);
});

it("says when the password email couldn't send", async () => {
  resetFails = true;
  render(account({}));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Reset password"));

  expect(
    await screen.findByText("Couldn't send the email. Please try again."),
  ).toBeTruthy();
});

it("says a provider linked on return, and nothing for a cancellation", async () => {
  render(account({ entry: "/settings?apple=linked" }));
  expect(
    await screen.findByText("Your Apple account is now linked."),
  ).toBeTruthy();
  cleanup();

  render(account({ entry: "/settings?appleError=cancelled" }));
  await screen.findByText("g@example.com");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("says why a link was refused on return", async () => {
  render(account({ entry: "/settings?appleError=claimed_by_another_account" }));

  expect(
    await screen.findByText(
      "That Apple account is already linked to a different Alliance account.",
    ),
  ).toBeTruthy();
});

it("waits for pending edits to save before leaving for the provider", async () => {
  const queryClient = new QueryClient();
  const { rerender } = render(account({ saveStatus: "unsaved", queryClient }));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Connect Apple"));
  rerender(account({ saveStatus: "saving", queryClient }));
  expect(assign).not.toHaveBeenCalled();

  rerender(account({ saveStatus: "saved", queryClient }));

  await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
  const started = new URL(String(assign.mock.calls[0][0]));
  expect(started.origin + started.pathname).toBe(
    "https://worldalliance.org/api/auth/apple/start",
  );
  expect(started.searchParams.get("intent")).toBe("link");
  expect(started.searchParams.get("returnTo")).toBe(
    "https://worldalliance.org/settings#account",
  );
});

it("renews the session before leaving for the provider", async () => {
  render(account({}));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Connect Apple"));

  await waitFor(() => expect(journey).toEqual(["refresh", "assign"]));
});

it("stays when the session can't be renewed", async () => {
  refreshStatus = 401;
  render(account({}));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Connect Apple"));

  expect(
    await screen.findByText(
      "Your session has expired. Sign in again to connect Apple.",
    ),
  ).toBeTruthy();
  expect(assign).not.toHaveBeenCalled();
  expect(button("Connect Apple").disabled).toBe(false);
});

it("stays when pending edits can't save", async () => {
  const queryClient = new QueryClient();
  const { rerender } = render(account({ saveStatus: "unsaved", queryClient }));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Connect Apple"));
  rerender(account({ saveStatus: "blocked", queryClient }));

  expect(
    await screen.findByText(/Your settings changes haven't saved/),
  ).toBeTruthy();
  expect(assign).not.toHaveBeenCalled();
  expect(button("Connect Apple").disabled).toBe(false);
});

it("unlocks Connect when Back restores the page mid-connect", async () => {
  render(account({}));
  await screen.findByText("g@example.com");

  fireEvent.click(button("Connect Apple"));
  await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
  expect(button("Connecting... Apple").disabled).toBe(true);

  const restored = new Event("pageshow");
  Object.defineProperty(restored, "persisted", { value: true });
  fireEvent(window, restored);

  expect(button("Connect Apple").disabled).toBe(false);
});

it("offers Disconnect once a password is set elsewhere and the member returns", async () => {
  me = makeUser({ hasPassword: false, oauthAccounts: [google] });
  render(account({}));
  await screen.findByText("g@example.com");
  expect(button("Disconnect Google").disabled).toBe(true);

  me = { ...me, hasPassword: true };
  fireEvent(window, new Event("visibilitychange"));

  await waitFor(() => expect(button("Disconnect Google").disabled).toBe(false));
});
