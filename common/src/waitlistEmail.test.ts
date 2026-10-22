import { describe, expect, it } from "bun:test";
import {
  findWaitlistEmailPlaceholders,
  replaceWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
  withoutOrganizationMessage,
} from "./waitlistEmail";

describe("waitlist email placeholders", () => {
  it("finds known placeholders across texts and lists unknown ones once", () => {
    const { used, unknown } = findWaitlistEmailPlaceholders([
      "Hi #{name}, from #{organizationName}",
      "#{signupLink} #{firstname} #{} #{firstname}",
    ]);
    expect([...used]).toEqual([
      WaitlistEmailPlaceholder.Name,
      WaitlistEmailPlaceholder.OrganizationName,
      WaitlistEmailPlaceholder.SignupLink,
    ]);
    expect(unknown).toEqual(["#{firstname}", "#{}"]);
  });

  it("reads an unclosed placeholder as unknown", () => {
    expect(
      findWaitlistEmailPlaceholders(["Hi #{name\nJoin with #{signupLink}"]),
    ).toEqual({
      used: new Set([WaitlistEmailPlaceholder.SignupLink]),
      unknown: ["#{name"],
    });
  });

  it("replaces known placeholders and leaves unknown ones", () => {
    expect(
      replaceWaitlistEmailPlaceholders(
        "#{name} #{name} #{nope} #{signupLink",
        (placeholder) => `<${placeholder}>`,
      ),
    ).toBe("<name> <name> #{nope} #{signupLink");
  });

  it("says how many recipients lack an organization", () => {
    expect(withoutOrganizationMessage(1)).toBe(
      "1 recipient has no organization for #{organizationName}",
    );
    expect(withoutOrganizationMessage(2)).toBe(
      "2 recipients have no organization for #{organizationName}",
    );
  });
});
