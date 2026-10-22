import { addDays, addSeconds, subDays } from "date-fns";
import {
  isLegacyDomain,
  isSnoozed,
  newDomainUrl,
  redirectAlreadyTried,
  redirectToNewDomain,
  snooze,
} from "./domainMigration";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

describe("isLegacyDomain", () => {
  test("accepts the bare domain and its subdomains", () => {
    expect(isLegacyDomain("worldalliance.org")).toBe(true);
    expect(isLegacyDomain("staging.worldalliance.org")).toBe(true);
    expect(isLegacyDomain("www.worldalliance.org")).toBe(true);
  });

  test("rejects the new domain and lookalikes", () => {
    expect(isLegacyDomain("thealliance.org")).toBe(false);
    expect(isLegacyDomain("staging.thealliance.org")).toBe(false);
    expect(isLegacyDomain("notworldalliance.org")).toBe(false);
    expect(isLegacyDomain("localhost")).toBe(false);
  });
});

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

describe("snooze", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("is inactive until someone snoozes", () => {
    expect(isSnoozed(new Date())).toBe(false);
  });

  test("covers the day after it is set", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    snooze(now);
    expect(isSnoozed(addDays(now, 1))).toBe(true);
  });

  test("expires on the second day", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    snooze(now);
    expect(isSnoozed(addDays(now, 2))).toBe(false);
  });

  test("ignores a garbage value", () => {
    window.localStorage.setItem("domain-migration-snoozed-at", "nonsense");
    expect(isSnoozed(new Date())).toBe(false);
  });

  test("a stale snooze from before the window does not reactivate", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    snooze(subDays(now, 30));
    expect(isSnoozed(now)).toBe(false);
  });
});
