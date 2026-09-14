import type { UserDto } from "@alliance/shared/client";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { subMinutes } from "date-fns";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import DomainMigrationModal from "./DomainMigrationModal";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

const TITLE = "We're moving to thealliance.org";
const STRANDED_TITLE = "Your account lives on thealliance.org now";

// By role, not text: the title carries inline emphasis, which `getByText` does
// not read through.
const title = () => screen.queryByRole("heading", { name: TITLE });
const strandedTitle = () =>
  screen.queryByRole("heading", { name: STRANDED_TITLE });

const visitAs = (url: string, user: UserDto | undefined) => {
  window.happyDOM.setURL(url);
  render(
    <AuthContext.Provider value={authValue({ user })}>
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
  window.sessionStorage.clear();
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

  test("moves someone who already switched to the new domain", () => {
    visitAs("https://worldalliance.org/actions?tab=open#top", switchedUser);

    expect(title()).toBeNull();
    expect(window.location.href).toBe(
      "https://thealliance.org/actions?tab=open#top",
    );
  });

  test("leaves someone who already switched alone on the new domain", () => {
    visitAs("https://thealliance.org/actions", switchedUser);

    expect(title()).toBeNull();
    expect(window.location.href).toBe("https://thealliance.org/actions");
  });

  test("gives up after one hop that left them on the old domain", () => {
    visitAs("https://worldalliance.org/actions", switchedUser);
    expect(window.location.href).toBe("https://thealliance.org/actions");

    cleanup();
    window.happyDOM.setURL("https://worldalliance.org/actions");
    visitAs("https://worldalliance.org/actions", switchedUser);

    expect(window.location.href).toBe("https://worldalliance.org/actions");
    expect(strandedTitle()).not.toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Go to thealliance.org" })
        .getAttribute("href"),
    ).toBe("https://thealliance.org/actions");
  });

  test("tries again for an old link opened later in the same tab", () => {
    visitAs("https://worldalliance.org/actions", switchedUser);
    expect(window.location.href).toBe("https://thealliance.org/actions");

    cleanup();
    window.sessionStorage.setItem(
      "domain-migration-redirected",
      String(subMinutes(new Date(), 5).getTime()),
    );
    visitAs("https://worldalliance.org/actions/5", switchedUser);

    expect(window.location.href).toBe("https://thealliance.org/actions/5");
    expect(strandedTitle()).toBeNull();
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
