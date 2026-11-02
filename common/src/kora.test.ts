import { describe, expect, it } from "bun:test";
import { koraAvailable, koraOAuthErrorMessage } from "./kora";
import { OAuthError, OAuthProvider } from "./oauth";

describe("koraAvailable", () => {
  it("is on in production and staging", () => {
    expect(koraAvailable("production")).toBe(true);
    expect(koraAvailable("staging")).toBe(true);
  });

  it("stays off wherever the environment is unrecognized", () => {
    expect(koraAvailable("prod")).toBe(false);
    expect(koraAvailable(undefined)).toBe(false);
  });
});

describe("koraOAuthErrorMessage", () => {
  it("never sends a participant toward invites or member accounts", () => {
    for (const error of Object.values(OAuthError)) {
      expect(koraOAuthErrorMessage(OAuthProvider.Google, error)).not.toMatch(
        /invite|Alliance account|password/i,
      );
    }
  });

  it("offers a code when the provider has not verified the email", () => {
    expect(
      koraOAuthErrorMessage(OAuthProvider.Apple, OAuthError.EmailNotVerified),
    ).toBe(
      "Apple hasn’t verified that email address. Continue with your email or mobile number instead.",
    );
  });
});
