import { describe, expect, it } from "bun:test";
import { koraAvailable, koraOAuthErrorMessage } from "./kora";
import { OAuthError, OAuthProvider } from "./oauth";

describe("koraAvailable", () => {
  it("stays off in production and wherever the environment is unrecognized", () => {
    expect(koraAvailable("production")).toBe(false);
    expect(koraAvailable("prod")).toBe(false);
    expect(koraAvailable(undefined)).toBe(false);
  });

  it("is on in staging", () => {
    expect(koraAvailable("staging")).toBe(true);
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
