import { describe, expect, it } from "bun:test";
import {
  waitlistLinkUrl,
  waitlistShareUrl,
  waitlistUnsubscribeUrl,
} from "./waitlist";

describe("waitlist urls", () => {
  it("puts an organization link's code in ?link= and a personal code in ?ref=", () => {
    expect(waitlistLinkUrl("https://example.com", "a+b")).toBe(
      "https://example.com/projects/democratic-grantmaking-26?link=a%2Bb",
    );
    expect(waitlistShareUrl("https://example.com", "abc")).toBe(
      "https://example.com/projects/democratic-grantmaking-26?ref=abc",
    );
  });

  it("puts the unsubscribe token in ?token=", () => {
    expect(waitlistUnsubscribeUrl("https://example.com", "t-1")).toBe(
      "https://example.com/waitlist/unsubscribe?token=t-1",
    );
  });
});
