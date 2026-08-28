import type { UserDto } from "@alliance/shared/client";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import DomainMigrationModal from "./DomainMigrationModal";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

const TITLE = "We're moving to thealliance.org";

// By role, not text: the title carries inline emphasis, which `getByText` does
// not read through.
const title = () => screen.queryByRole("heading", { name: TITLE });

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

const visitAs = (url: string, user: UserDto | undefined) => {
  window.happyDOM.setURL(url);
  render(
    <AuthContext.Provider value={authValue(user)}>
      <ToastProvider>
        <DomainMigrationModal />
      </ToastProvider>
    </AuthContext.Provider>,
  );
};

const switchedUser: UserDto = {
  ...testAuthUser,
  switchedDomainAt: "2026-08-01T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("DomainMigrationModal", () => {
  test("prompts a member still on the old domain", () => {
    visitAs("https://worldalliance.org/actions", testAuthUser);

    expect(title()).not.toBeNull();
  });

  test("prompts on the old staging domain too", () => {
    visitAs("https://staging.worldalliance.org/actions", testAuthUser);

    expect(title()).not.toBeNull();
  });

  test("stays away on the new domain", () => {
    visitAs("https://thealliance.org/actions", testAuthUser);

    expect(title()).toBeNull();
  });

  test("stays away from someone who already switched", () => {
    visitAs("https://worldalliance.org/actions", switchedUser);

    expect(title()).toBeNull();
  });

  test("stays away from a logged-out visitor", () => {
    visitAs("https://worldalliance.org/actions", undefined);

    expect(title()).toBeNull();
  });

  test("'Not right now' closes it and it stays gone on the next visit", () => {
    visitAs("https://worldalliance.org/actions", testAuthUser);

    fireEvent.click(screen.getByRole("button", { name: "Not right now" }));
    expect(title()).toBeNull();

    cleanup();
    visitAs("https://worldalliance.org/actions", testAuthUser);
    expect(title()).toBeNull();
  });
});
