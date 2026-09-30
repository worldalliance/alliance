import { describe, expect, it } from "bun:test";
import { waitlistLinkUrl, waitlistShareUrl } from "./waitlist";

describe("waitlist urls", () => {
  it("puts an organization link's code in ?link= and a personal code in ?ref=", () => {
    expect(waitlistLinkUrl("https://example.com", "a+b")).toBe(
      "https://example.com/projects/democratic-grantmaking-26?link=a%2Bb",
    );
    expect(waitlistShareUrl("https://example.com", "abc")).toBe(
      "https://example.com/projects/democratic-grantmaking-26?ref=abc",
    );
  });
});
