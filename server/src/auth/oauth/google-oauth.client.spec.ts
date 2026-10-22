import { R } from "@alliance/common/result";
import { OAuth2Client } from "google-auth-library";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { GoogleOAuthClient } from "./google-oauth.client";

const rejection = async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const token = await new SignJWT({
    email: "ada@example.com",
    name: "Ada Lovelace",
  })
    .setProtectedHeader({ alg: "RS256", kid: "key" })
    .setSubject("1234567890")
    .setIssuedAt(1700000000)
    .setExpirationTime(1700000600)
    .sign(privateKey);
  const verified = await R.fromPromise(
    new OAuth2Client().verifySignedJwtWithCertsAsync(token, {
      key: await exportSPKI(publicKey),
    }),
  );
  if (verified.ok) {
    throw new Error("expected the token to be rejected");
  }
  return verified.error;
};

describe("verifyIdentityToken", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps the claims of a rejected token out of its failure", async () => {
    process.env.GOOGLE_CLIENT_ID = "web.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    const error = await rejection();
    expect(error.message).toContain("ada@example.com");
    jest
      .spyOn(OAuth2Client.prototype, "verifyIdToken")
      .mockImplementation(() => Promise.reject(error));

    const verified = await new GoogleOAuthClient().verifyIdentityToken("token");

    expect(verified.ok).toBe(false);
    const logged = Bun.inspect(!verified.ok && verified.error);
    expect(logged).not.toContain("ada@example.com");
    expect(logged).not.toContain("1234567890");
  });
});
