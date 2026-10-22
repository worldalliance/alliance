import { OAuthProvider } from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import * as jose from "jose";
import { generateKeyPair, jwtVerify, SignJWT } from "jose";
import {
  appleCallbackName,
  AppleOAuthClient,
  appleProfile,
  appleTokenFailure,
} from "./apple-oauth.client";

describe("appleCallbackName", () => {
  it("joins the parts Apple posts on the first authorization", () => {
    expect(
      appleCallbackName(
        JSON.stringify({ name: { firstName: "Ada", lastName: "Lovelace" } }),
      ),
    ).toBe("Ada Lovelace");
  });

  it("copes with one part missing", () => {
    expect(
      appleCallbackName(JSON.stringify({ name: { firstName: "Ada" } })),
    ).toBe("Ada");
  });

  it.each([undefined, "", "not json", JSON.stringify({ email: "a@b.c" })])(
    "is null for %p",
    (callbackUser) => {
      expect(appleCallbackName(callbackUser)).toBeNull();
    },
  );
});

describe("appleProfile", () => {
  const claims = {
    sub: "001234.abcdef",
    email: "ada@privaterelay.appleid.com",
  };

  it("reads Apple's string booleans as booleans", () => {
    const profile = appleProfile({ ...claims, email_verified: "true" }, null);
    expect(profile.ok && profile.value).toEqual({
      provider: OAuthProvider.Apple,
      subject: claims.sub,
      email: claims.email,
      emailVerified: true,
      name: null,
    });
  });

  it("treats a missing email_verified as unverified", () => {
    const profile = appleProfile(claims, "Ada");
    expect(profile.ok && profile.value.emailVerified).toBe(false);
  });

  it("fails without an email", () => {
    expect(appleProfile({ sub: claims.sub }, null).ok).toBe(false);
  });
});

describe("exchangeCode", () => {
  it("fails rather than throwing when the private key will not load", async () => {
    process.env.APPLE_TEAM_ID = "629G87T7R5";
    process.env.APPLE_KEY_ID = "T32B4D3S84";
    process.env.APPLE_SERVICES_ID = "org.example.signin";
    process.env.APPLE_BUNDLE_ID = "com.example.app";
    process.env.APPLE_PRIVATE_KEY_BASE64 =
      Buffer.from("not a pkcs8 key").toString("base64");

    const exchanged = await new AppleOAuthClient().exchangeCode({
      code: "abc",
      redirectUri: "https://example.com/api/auth/apple/callback",
      callbackUser: undefined,
    });

    expect(exchanged.ok).toBe(false);
  });
});

const rejectedToken = async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const expired = await new SignJWT({ email: "ada@example.com" })
    .setProtectedHeader({ alg: "ES256" })
    .setSubject("001234.abcdef")
    .setIssuedAt(1700000000)
    .setExpirationTime(1700000600)
    .sign(privateKey);
  const rejected = await R.fromPromise(jwtVerify(expired, publicKey));
  if (rejected.ok) {
    throw new Error("expected the expired token to be rejected");
  }
  return rejected.error;
};

describe("appleTokenFailure", () => {
  it("keeps the claims of a rejected token out of the error", async () => {
    const logged = Bun.inspect(appleTokenFailure(await rejectedToken()));

    expect(logged).toContain("ERR_JWT_EXPIRED");
    expect(logged).toContain('"exp" claim');
    expect(logged).not.toContain("ada@example.com");
    expect(logged).not.toContain("001234.abcdef");
  });
});

describe("verifyIdentityToken", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps the claims of a rejected token out of its failure", async () => {
    process.env.APPLE_TEAM_ID = "629G87T7R5";
    process.env.APPLE_KEY_ID = "T32B4D3S84";
    process.env.APPLE_SERVICES_ID = "org.example.signin";
    process.env.APPLE_BUNDLE_ID = "com.example.app";
    process.env.APPLE_PRIVATE_KEY_BASE64 =
      Buffer.from("unused").toString("base64");
    const rejection = await rejectedToken();
    jest
      .spyOn(jose, "jwtVerify")
      .mockImplementation(() => Promise.reject(rejection));

    const verified = await new AppleOAuthClient().verifyIdentityToken("token");

    expect(verified.ok).toBe(false);
    const logged = Bun.inspect(!verified.ok && verified.error);
    expect(logged).toContain("ERR_JWT_EXPIRED");
    expect(logged).not.toContain("ada@example.com");
  });
});
