import { OAuthProvider } from "@alliance/common/oauth";
import { authMe, type UserDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import * as frontendConfig from "../lib/config";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import OAuthAccountLinks from "./OAuthAccountLinks";

let unreachable = false;
let refused: { statusCode: number; message: string } | null = null;
let sessionLapsed = false;
let held: Promise<void> | null = null;
const unlinked: string[] = [];
const visits: string[] = [];
let member: UserDto = testAuthUser;

serveApi(
  routes({
    "GET /auth/me": () => {
      visits.push("/auth/me");
      if (unreachable) throw new TypeError("Failed to fetch");
      if (sessionLapsed) {
        return Response.json(
          { statusCode: 401, message: "Unauthorized" },
          { status: 401 },
        );
      }
      return Response.json({ user: member });
    },
    "DELETE /auth/:provider/link": async ({ params }) => {
      await held;
      if (unreachable) throw new TypeError("Failed to fetch");
      if (refused) {
        return Response.json(refused, { status: refused.statusCode });
      }
      unlinked.push(params.provider);
      return Response.json({
        user: {
          ...member,
          oauthAccounts: member.oauthAccounts?.filter(
            (a) => a.provider !== params.provider,
          ),
        },
      });
    },
  }),
);

const scrolledTo: Element[] = [];

beforeEach(() => {
  jest.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (
    this: Element,
  ) {
    scrolledTo.push(this);
  });
  // No value outside a built app.
  jest
    .spyOn(frontendConfig, "getApiUrl")
    .mockReturnValue("https://thealliance.org/api");
  jest.spyOn(window.location, "assign").mockImplementation((url) => {
    visits.push(String(url));
  });
});

window.happyDOM.setURL("https://test.alliance/settings");

const GOOGLE = { provider: OAuthProvider.Google, email: "m@gmail.com" };
const APPLE = { provider: OAuthProvider.Apple, email: "m@icloud.com" };

const LOCKED_OUT = /only way into your account/;

const Settings = ({ initial }: { initial: UserDto }) => {
  const [user, setUser] = useState(initial);
  const refreshUser = async () => {
    const { data } = await authMe();
    if (data) setUser(data.user);
  };
  return (
    <AuthContext.Provider value={authValue({ user, setUser, refreshUser })}>
      <OAuthAccountLinks />
    </AuthContext.Provider>
  );
};

const settingsAs = (user: UserDto, url = "/settings") => {
  member = user;
  render(
    <MemoryRouter initialEntries={[url]}>
      <Settings initial={user} />
    </MemoryRouter>,
  );
};

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  unreachable = false;
  refused = null;
  sessionLapsed = false;
  held = null;
  unlinked.length = 0;
  visits.length = 0;
  scrolledTo.length = 0;
});

it("offers a disconnect for what is linked and a connect for what is not", () => {
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE] });

  expect(screen.getByText(GOOGLE.email)).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Disconnect Google" }),
  ).toBeDefined();
  expect(screen.getByRole("button", { name: "Connect Apple" })).toBeDefined();
});

it("renews the session before it leaves for the provider", async () => {
  settingsAs({ ...testAuthUser, oauthAccounts: [] });

  fireEvent.click(screen.getByRole("button", { name: "Connect Apple" }));

  await waitFor(() => expect(visits.length).toBe(2));
  expect(visits[0]).toBe("/auth/me");
  const start = new URL(visits[1]);
  expect(start.pathname).toBe("/api/auth/apple/start");
  expect(start.searchParams.get("intent")).toBe("link");
  expect(start.searchParams.get("returnTo")).toBe(
    "https://test.alliance/settings",
  );
});

it("stays on the page when the session check never reaches the server", async () => {
  unreachable = true;
  settingsAs({ ...testAuthUser, oauthAccounts: [] });

  fireEvent.click(screen.getByRole("button", { name: "Connect Apple" }));

  await screen.findByText(/Could not connect. Check your connection/);
  expect(visits).toEqual(["/auth/me"]);
  expect(
    screen
      .getByRole("button", { name: "Connect Apple" })
      .getAttribute("disabled"),
  ).toBeNull();
});

// In the app, AppLayout answers the failed refresh by sending the member to
// sign in, which this test leaves out.
it("does not start the link when the session cannot be renewed", async () => {
  sessionLapsed = true;
  settingsAs({ ...testAuthUser, oauthAccounts: [] });

  fireEvent.click(screen.getByRole("button", { name: "Connect Apple" }));

  await screen.findByText(/session has expired/);
  expect(visits).toEqual(["/auth/me"]);
});

it("refuses to disconnect the only way in, and says so beside it", () => {
  settingsAs({
    ...testAuthUser,
    hasPassword: false,
    oauthAccounts: [GOOGLE],
  });

  const disconnect = screen.getByRole("button", { name: "Disconnect Google" });
  fireEvent.click(disconnect);

  expect(disconnect.getAttribute("disabled")).not.toBeNull();
  expect(unlinked).toEqual([]);
  const reason = screen.getByText(/^Google is the only way into your account/);
  // Named and in the Google row, so it cannot read as being about Apple.
  expect(reason.closest("div")?.contains(disconnect)).toBe(true);
});

it("says nothing about a last way in with nothing to disconnect", () => {
  settingsAs({ ...testAuthUser, hasPassword: false, oauthAccounts: [] });

  expect(screen.queryByRole("button", { name: /Disconnect/ })).toBeNull();
  expect(screen.queryByText(LOCKED_OUT)).toBeNull();
});

it("disconnects once a password stands behind the account", async () => {
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE, APPLE] });

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Apple" }));

  await screen.findByRole("button", { name: "Connect Apple" });
  expect(unlinked).toEqual([OAuthProvider.Apple]);
  expect(screen.queryByText(LOCKED_OUT)).toBeNull();
});

it("sends one disconnect at a time", async () => {
  let land = () => {};
  held = new Promise((resolve) => {
    land = resolve;
  });
  settingsAs({
    ...testAuthUser,
    hasPassword: false,
    oauthAccounts: [GOOGLE, APPLE],
  });

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
  await screen.findByRole("button", { name: "Disconnecting..." });
  const apple = screen.getByRole("button", { name: "Disconnect Apple" });
  fireEvent.click(apple);

  expect(apple.getAttribute("disabled")).not.toBeNull();
  land();
  await screen.findByRole("button", { name: "Connect Google" });
  expect(unlinked).toEqual([OAuthProvider.Google]);
});

it("lets go of the last way in once a password is set elsewhere", async () => {
  settingsAs({ ...testAuthUser, hasPassword: false, oauthAccounts: [GOOGLE] });
  member = { ...member, hasPassword: true };

  document.dispatchEvent(new Event("visibilitychange"));

  await waitFor(() => expect(screen.queryByText(LOCKED_OUT)).toBeNull());
  expect(
    screen
      .getByRole("button", { name: "Disconnect Google" })
      .getAttribute("disabled"),
  ).toBeNull();
});

it("does not reload the member on return with no disconnect waiting on a password", async () => {
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE] });

  document.dispatchEvent(new Event("visibilitychange"));
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(visits).toEqual([]);
});

it("shows what the server refused", async () => {
  refused = {
    statusCode: 400,
    message: "Apple is the only way into your account.",
  };
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE] });

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));

  await screen.findByText(refused.message);
  expect(
    screen.getByRole("button", { name: "Disconnect Google" }),
  ).toBeDefined();
});

it("catches up with a member changed in another tab when the server refuses", async () => {
  refused = {
    statusCode: 400,
    message:
      "Google is the only way into your account. Set a password or connect another account first.",
  };
  settingsAs({
    ...testAuthUser,
    hasPassword: false,
    oauthAccounts: [GOOGLE, APPLE],
  });
  member = { ...member, oauthAccounts: [GOOGLE] };

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));

  await screen.findByRole("button", { name: "Connect Apple" });
  await waitFor(() => expect(screen.getAllByText(LOCKED_OUT)).toHaveLength(1));
  expect(screen.queryByText(refused.message)).toBeNull();

  member = { ...member, hasPassword: true };
  document.dispatchEvent(new Event("visibilitychange"));

  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Disconnect Google" })
        .getAttribute("disabled"),
    ).toBeNull(),
  );
  expect(screen.queryByText(LOCKED_OUT)).toBeNull();
});

// Nest writes the message itself on a 401 and on anything from 5xx up, and
// "Unauthorized" beside a button reads as a permission the member lacks.
it("says what a lapsed session and a broken server really mean", async () => {
  refused = { statusCode: 401, message: "Unauthorized" };
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE] });

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));

  await screen.findByText(/session has expired/);
  expect(screen.queryByText("Unauthorized")).toBeNull();

  cleanup();
  refused = { statusCode: 500, message: "Internal server error" };
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE] });

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));

  await screen.findByText(/Could not disconnect/);
  expect(screen.queryByText("Internal server error")).toBeNull();
});

it("shows a message when the request never reaches the server", async () => {
  unreachable = true;
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE] });

  fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));

  await screen.findByText(/Check your connection/);
  expect(
    screen
      .getByRole("button", { name: "Disconnect Google" })
      .getAttribute("disabled"),
  ).toBeNull();
});

it("scrolls to what the provider sent the member back about", async () => {
  settingsAs(
    { ...testAuthUser, oauthAccounts: [GOOGLE] },
    "/settings?appleError=claimed_by_another_account",
  );

  const message = await screen.findByText(/already linked to a different/);
  await waitFor(() => expect(scrolledTo.length).toBe(1));
  expect(scrolledTo[0]?.contains(message)).toBe(true);
});

it("stays put with nothing to say", async () => {
  settingsAs({ ...testAuthUser, oauthAccounts: [GOOGLE] });

  expect(scrolledTo).toEqual([]);

  cleanup();
  settingsAs(
    { ...testAuthUser, oauthAccounts: [GOOGLE] },
    "/settings?google=signed_in",
  );
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(scrolledTo.length).toBe(0);
});
