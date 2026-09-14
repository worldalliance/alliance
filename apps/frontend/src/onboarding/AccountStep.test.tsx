import { ACCOUNT_MOVED_MESSAGE } from "@alliance/common/url";
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
import { MemoryRouter } from "react-router";
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

serveApi(
  routes({
    "POST /auth/login": async ({ request }) => {
      loginBodies.push(await request.json());
      return loginReply();
    },
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

const Harness = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tick, setTick] = useState(0);
  return (
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue}>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            parent update
          </button>
          <span data-testid="tick">{tick}</span>
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

const fillWithoutReact = (email: string, password: string) => {
  const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
  const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
  emailInput.value = email;
  passwordInput.value = password;
  return { emailInput, passwordInput };
};

describe("AccountStep", () => {
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
});
