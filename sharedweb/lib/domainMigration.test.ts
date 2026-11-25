import { addDays, addSeconds } from "date-fns";
import {
  newDomainUrl,
  redirectAlreadyTried,
  redirectToNewDomain,
} from "./domainMigration";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

describe("newDomainUrl", () => {
  test("swaps the domain, keeping path, query and hash", () => {
    expect(
      newDomainUrl({
        hostname: "worldalliance.org",
        pathname: "/settings",
        search: "?tab=account",
        hash: "#password",
      }),
    ).toBe("https://thealliance.org/settings?tab=account#password");
  });

  test("keeps the subdomain", () => {
    expect(
      newDomainUrl({
        hostname: "staging.worldalliance.org",
        pathname: "/",
        search: "",
        hash: "",
      }),
    ).toBe("https://staging.thealliance.org/");
  });
});

describe("redirectToNewDomain", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.happyDOM.setURL("https://worldalliance.org/actions?tab=open#top");
  });

  test("moves the reader and remembers the attempt", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    expect(redirectAlreadyTried(now)).toBe(false);

    redirectToNewDomain(window.location, now);

    expect(window.location.href).toBe(
      "https://thealliance.org/actions?tab=open#top",
    );
    expect(redirectAlreadyTried(now)).toBe(true);
  });

  test("a hop that bounced straight back still counts as tried", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    redirectToNewDomain(window.location, now);

    expect(redirectAlreadyTried(addSeconds(now, 9))).toBe(true);
  });

  test("an old link opened later in the same tab gets another hop", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    redirectToNewDomain(window.location, now);

    expect(redirectAlreadyTried(addSeconds(now, 11))).toBe(false);
    expect(redirectAlreadyTried(addDays(now, 1))).toBe(false);
  });

  test("ignores a garbage value", () => {
    window.sessionStorage.setItem("domain-migration-redirected", "nonsense");

    expect(redirectAlreadyTried(new Date())).toBe(false);
  });

  test("refuses a target on the origin already loaded", () => {
    window.happyDOM.setURL("https://thealliance.org/actions");

    expect(() => redirectToNewDomain(window.location, new Date())).toThrow(
      /would reload the same page/,
    );
    expect(window.location.href).toBe("https://thealliance.org/actions");
    expect(redirectAlreadyTried(new Date())).toBe(false);
  });
});
