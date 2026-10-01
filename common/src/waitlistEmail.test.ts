import { describe, expect, it } from "bun:test";
import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
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
});
