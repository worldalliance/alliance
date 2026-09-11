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

const authLogin = jest.fn(async () => ({ response: { ok: true } }));
const onLogin = jest.fn(async () => {});

jest.mock("@alliance/shared/client", () => ({
  authLogin,
  authForgotPassword: jest.fn(),
}));

jest.mock("@alliance/shared/lib/useInvite", () => ({
  useInvite: () => ({ used: false, pending: false, inviter: null }),
}));

jest.mock("@alliance/sharedweb/lib/oauth", () => ({
  oauthStartUrl: () => "http://localhost/oauth",
  useAppOrigin: () => "http://localhost:5173",
}));

jest.mock("../lib/config", () => ({
  getApiUrl: () => "http://localhost:3000",
  isFeatureEnabled: () => false,
}));

jest.mock("../site/content", () => ({
  JOIN_MAILTO: "mailto:join@example.com",
}));

jest.mock("../site/ui", () => ({
  SiteArrow: () => null,
}));

jest.mock("./GrantmakingCard", () => ({
  InfoSessionButton: () => null,
}));

jest.mock("@alliance/sharedweb/ui/OAuthButtons", () => ({
  __esModule: true,
  default: () => null,
}));

import { AccountStep } from "./AccountStep";

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

afterEach(() => {
  cleanup();
  authLogin.mockClear();
  onLogin.mockClear();
});

const Harness = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tick, setTick] = useState(0);
  return (
    <MemoryRouter>
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
      expect(authLogin).toHaveBeenCalledWith({
        body: {
          email: "member@example.com",
          password: "s3cret",
          mode: "cookie",
        },
      });
    });
  });
});
