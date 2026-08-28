import { addDays, subDays } from "date-fns";
import {
  isLegacyDomain,
  isSnoozed,
  newDomainUrl,
  snooze,
} from "./domainMigration";

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
  test("swaps the domain, keeping path and query", () => {
    expect(
      newDomainUrl({
        hostname: "worldalliance.org",
        pathname: "/settings",
        search: "?tab=account",
      }),
    ).toBe("https://thealliance.org/settings?tab=account");
  });

  test("keeps the subdomain", () => {
    expect(
      newDomainUrl({
        hostname: "staging.worldalliance.org",
        pathname: "/",
        search: "",
      }),
    ).toBe("https://staging.thealliance.org/");
  });
});

describe("snooze", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("is inactive until someone snoozes", () => {
    expect(isSnoozed(new Date())).toBe(false);
  });

  test("covers the four days after it is set", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    snooze(now);
    expect(isSnoozed(addDays(now, 4))).toBe(true);
  });

  test("expires on the fifth day", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    snooze(now);
    expect(isSnoozed(addDays(now, 5))).toBe(false);
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
