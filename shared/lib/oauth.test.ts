import { OAuthProvider } from "@alliance/common/oauth";
import { isLastWayIn } from "./oauth";

// The same two facts unlink() weighs in
// server/src/auth/oauth/oauth-auth.service.ts before refusing with
// LastSignInMethod. The two have to agree or the button lies.
const member = (hasPassword: boolean, providers: OAuthProvider[]) => ({
  hasPassword,
  oauthAccounts: providers.map((provider) => ({
    provider,
    email: "m@example.com",
  })),
});

it("is the last way in with no password and one provider", () => {
  expect(
    isLastWayIn(member(false, [OAuthProvider.Google]), OAuthProvider.Google),
  ).toBe(true);
});

it("is not the last way in with a password behind it", () => {
  expect(
    isLastWayIn(member(true, [OAuthProvider.Google]), OAuthProvider.Google),
  ).toBe(false);
});

it("is not the last way in with a second provider behind it", () => {
  expect(
    isLastWayIn(
      member(false, [OAuthProvider.Google, OAuthProvider.Apple]),
      OAuthProvider.Google,
    ),
  ).toBe(false);
});

it("is not the last way in for a provider that is not connected", () => {
  expect(
    isLastWayIn(member(false, [OAuthProvider.Google]), OAuthProvider.Apple),
  ).toBe(false);
  expect(isLastWayIn(member(false, []), OAuthProvider.Google)).toBe(false);
});

it("is not the last way in with a password and no provider", () => {
  expect(isLastWayIn(member(true, []), OAuthProvider.Google)).toBe(false);
});

it("counts an account list the server left off as none", () => {
  expect(isLastWayIn({ hasPassword: false }, OAuthProvider.Google)).toBe(false);
});
