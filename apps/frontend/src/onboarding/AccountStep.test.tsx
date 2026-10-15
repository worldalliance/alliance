import {
  REVIEW_ACCOUNT_MESSAGE,
  REVIEW_SIGN_IN_FAILED_PARAM,
  REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE,
} from "@alliance/common/review-account";
import { ACCOUNT_MOVED_MESSAGE, STAGING_SITE_URL } from "@alliance/common/url";
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
import { useState } from "react";
import { MemoryRouter, useLocation, type InitialEntry } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { AccountStep } from "./AccountStep";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

let loginBodies: { email: string; password: string; mode: string }[] = [];

const signedIn = () => new Response(null, { status: 200 });
let loginReply: () => Response = signedIn;

/** What the two lookups behind the code in the URL come back with. */
let inviteState: "valid" | "used" | "pending" | "unknown" = "valid";

const INVITE_STATUS = {
  valid: "link_unused",
  used: "link_used",
  pending: "request_pending",
} as const;

const notFound = () => new Response(null, { status: 404 });

serveApi(
  routes({
    "POST /auth/login": async ({ request }) => {
      loginBodies.push(await request.json());
      return loginReply();
    },
    "GET /user/referrerProfile/:code": () =>
      inviteState === "unknown"
        ? notFound()
        : Response.json({
            kind: "user",
            displayName: "Alex Dorey",
            profilePicture: null,
          }),
    "GET /user/onetimeInvite/:code": () =>
      inviteState === "unknown"
        ? notFound()
        : Response.json({
            code: "invite-code",
            status: INVITE_STATUS[inviteState],
          }),
  }),
);

const onLogin = jest.fn(async () => {});

// The OAuth return URL the account step builds needs a real origin.
window.happyDOM.setURL("https://test.alliance/login");

beforeEach(() => {
  // getBaseUrl reads build-time env the test process does not set.
  jest
    .spyOn(configModule, "getBaseUrl")
    .mockReturnValue("https://test.alliance");
});

afterEach(() => {
  cleanup();
  onLogin.mockClear();
  loginBodies = [];
  loginReply = signedIn;
  inviteState = "valid";
  window.sessionStorage.clear();
  window.happyDOM.setURL("https://test.alliance/login");
});

const noop = () => Promise.resolve();

const authValue: AuthContextType = {
  isAuthenticated: false,
  user: undefined,
  isImpersonation: false,
  refreshUser: noop,
  login: noop,
  onLogin,
  logout: noop,
  loading: false,
};

const Search = () => <span data-testid="search">{useLocation().search}</span>;

const Harness = ({ entry = "/" }: { entry?: InitialEntry }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tick, setTick] = useState(0);
  return (
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue}>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            parent update
          </button>
          <span data-testid="tick">{tick}</span>
          <Search />
          <AccountStep
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            onCreateAccount={() => {}}
            redirectAfterLogin="/tasks"
            startInLogin
            referralCode={null}
            providerError={null}
          />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const SignUpWithCode = () => (
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={authValue}>
        <AccountStep
          email=""
          onEmailChange={() => {}}
          password=""
          onPasswordChange={() => {}}
          onCreateAccount={() => {}}
          redirectAfterLogin="/tasks"
          startInLogin={false}
          referralCode="some-code"
          providerError={null}
        />
      </AuthContext.Provider>
    </QueryClientProvider>
  </MemoryRouter>
);

const providerButtons = () =>
  document.querySelectorAll("a[href*='/auth/']").length;

const fillWithoutReact = (email: string, password: string) => {
  const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
  const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
  emailInput.value = email;
  passwordInput.value = password;
  return { emailInput, passwordInput };
};

describe("AccountStep", () => {
  // The server only rejects a code that names nothing once the provider has
  // handed the member back, so the screen has to refuse it before the trip.
  it("refuses a code that resolves to nothing", async () => {
    inviteState = "unknown";
    render(<SignUpWithCode />);

    await waitFor(() =>
      expect(screen.getByText("This invite link isn’t valid.")).toBeDefined(),
    );
    expect(providerButtons()).toBe(0);
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it.each([
    ["used", "This invite link has already been used."],
    ["pending", "This invite link isn’t active."],
  ] as const)("refuses a %s invite", async (state, heading) => {
    inviteState = state;
    render(<SignUpWithCode />);

    await waitFor(() => expect(screen.getByText(heading)).toBeDefined());
    expect(providerButtons()).toBe(0);
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("offers a code that resolves", async () => {
    inviteState = "valid";
    render(<SignUpWithCode />);

    await waitFor(() => expect(providerButtons()).toBeGreaterThan(0));
    expect(screen.getByLabelText("Email")).toBeDefined();
  });

  it("logs in from a password-manager fill that never fires change", async () => {
    render(<Harness />);

    const { emailInput, passwordInput } = fillWithoutReact(
      "member@example.com",
      "s3cret",
    );

    fireEvent.click(screen.getByRole("button", { name: "parent update" }));
    expect(screen.getByTestId("tick").textContent).toBe("1");
    expect(emailInput.value).toBe("member@example.com");
    expect(passwordInput.value).toBe("s3cret");

    const submit = screen.getByRole("button", { name: /log in/i });
    expect(submit.hasAttribute("disabled")).toBe(false);

    fireEvent.click(submit);
    await waitFor(() => {
      expect(loginBodies).toEqual([
        {
          email: "member@example.com",
          password: "s3cret",
          mode: "cookie",
        },
      ]);
    });
  });

  it("shows the message the page that sent the member here hands over", () => {
    render(
      <Harness
        entry={{ pathname: "/login", state: { message: "Handed over." } }}
      />,
    );

    expect(screen.getByText("Handed over.")).toBeDefined();
  });

  it("sends a migrated account to the new domain instead of signing it in", async () => {
    window.happyDOM.setURL("https://worldalliance.org/login?redirect=%2Ftasks");
    loginReply = () =>
      Response.json(
        { statusCode: 409, message: ACCOUNT_MOVED_MESSAGE },
        { status: 409 },
      );
    render(<Harness />);

    fillWithoutReact("moved@example.com", "s3cret");
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(window.location.href).toBe(
        "https://thealliance.org/login?redirect=%2Ftasks",
      );
    });
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("stops hopping a migrated account once one hop has bounced back", async () => {
    window.happyDOM.setURL("https://worldalliance.org/login?redirect=%2Ftasks");
    window.sessionStorage.setItem(
      "domain-migration-redirected",
      String(Date.now()),
    );
    loginReply = () =>
      Response.json(
        { statusCode: 409, message: ACCOUNT_MOVED_MESSAGE },
        { status: 409 },
      );
    render(<Harness />);

    fillWithoutReact("moved@example.com", "s3cret");
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    const link = await screen.findByRole("link", {
      name: "Log in at thealliance.org",
    });
    expect(link.getAttribute("href")).toBe(
      "https://thealliance.org/login?redirect=%2Ftasks",
    );
    expect(window.location.href).toBe(
      "https://worldalliance.org/login?redirect=%2Ftasks",
    );
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("posts a review account's credentials to staging instead of signing it in", async () => {
    const submitted: HTMLFormElement[] = [];
    jest
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(function (this: HTMLFormElement) {
        submitted.push(this);
      });
    loginReply = () =>
      Response.json(
        { statusCode: 403, message: REVIEW_ACCOUNT_MESSAGE },
        { status: 403 },
      );
    render(<Harness />);

    fillWithoutReact("reviewer@example.com", "s3cret");
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => expect(submitted).toHaveLength(1));
    const [form] = submitted;
    expect(form.method.toUpperCase()).toBe("POST");
    expect(form.action).toBe(`${STAGING_SITE_URL}/api/auth/review-login`);
    expect(Object.fromEntries(new FormData(form))).toEqual({
      email: "reviewer@example.com",
      password: "s3cret",
    });
    expect(onLogin).not.toHaveBeenCalled();
    expect(screen.queryByText("Invalid email or password")).toBeNull();
  });

  it("says review sign-in is unavailable when staging sends the reviewer back", () => {
    render(<Harness entry={`/login?${REVIEW_SIGN_IN_FAILED_PARAM}=1`} />);

    expect(screen.getByRole("alert").textContent).toBe(
      REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE,
    );
  });

  it("strips the review sign-in failure from the URL so a reload doesn't replay it", () => {
    render(
      <Harness entry={`/login?ref=abc&${REVIEW_SIGN_IN_FAILED_PARAM}=1`} />,
    );

    expect(screen.getByTestId("search").textContent).toBe("?ref=abc");
    expect(screen.getByRole("alert").textContent).toBe(
      REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE,
    );
  });

  it("drops the review sign-in failure once the member tries again", async () => {
    loginReply = () => Response.json({ statusCode: 401 }, { status: 401 });
    render(<Harness entry={`/login?${REVIEW_SIGN_IN_FAILED_PARAM}=1`} />);

    fillWithoutReact("reviewer@example.com", "wrong");
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await screen.findByText("Invalid email or password");
    expect(screen.queryByText(REVIEW_SIGN_IN_UNAVAILABLE_MESSAGE)).toBeNull();
  });
});
