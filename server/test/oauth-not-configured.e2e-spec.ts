import { KORA_PROJECT_PATH } from "@alliance/common/kora";
import { OAuthError, OAuthIntent, OAuthProvider } from "@alliance/common/oauth";
import { AppleOAuthClient } from "src/auth/oauth/apple-oauth.client";
import { GoogleOAuthClient } from "src/auth/oauth/google-oauth.client";
import { KoraModule } from "src/kora/kora.module";
import request from "supertest";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { ORIGIN } from "./kora-fixtures";

const RETURN_TO = "http://localhost:5173/login";

describe("OAuth on a server without the provider's credentials (e2e)", () => {
  let ctx: TestContext;

  const client = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp([KoraModule]);
    for (const oauth of [
      ctx.app.get(GoogleOAuthClient),
      ctx.app.get(AppleOAuthClient),
    ]) {
      oauth.isConfigured = () => false;
    }
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it.each(Object.values(OAuthProvider))(
    "sends a %s start back to where it came from, saying so",
    async (provider) => {
      const started = await client()
        .get(`/auth/${provider}/start`)
        .query({ intent: OAuthIntent.Authenticate, returnTo: RETURN_TO })
        .expect(302);

      expect(started.headers.location).toBe(
        `${RETURN_TO}?${provider}Error=${OAuthError.NotConfigured}`,
      );
      expect(started.headers["set-cookie"]).toBeUndefined();
    },
  );

  it("still refuses a returnTo that is not ours", async () => {
    await client()
      .get(`/auth/${OAuthProvider.Google}/start`)
      .query({
        intent: OAuthIntent.Authenticate,
        returnTo: "http://evil.example.com/x",
      })
      .expect(400);
  });

  it("still refuses an unauthenticated link", async () => {
    await client()
      .get(`/auth/${OAuthProvider.Google}/start`)
      .query({ intent: OAuthIntent.Link, returnTo: RETURN_TO })
      .expect(401);
  });

  it("sends a Kora start back to the project page, saying so", async () => {
    const returnTo = `${ORIGIN}${KORA_PROJECT_PATH}`;
    const started = await client()
      .get(`/kora/${OAuthProvider.Google}/start`)
      .query({ returnTo })
      .expect(302);

    expect(started.headers.location).toBe(
      `${returnTo}?googleError=${OAuthError.NotConfigured}`,
    );
  });

  it("answers the app's native sign-in with the reason", async () => {
    const answered = await client()
      .post(`/auth/${OAuthProvider.Google}/native`)
      .send({ identityToken: "token" })
      .expect(200);

    expect(answered.body).toEqual({ error: OAuthError.NotConfigured });
  });

  it("answers the app's native link with the reason", async () => {
    const answered = await client()
      .post(`/auth/${OAuthProvider.Apple}/link/native`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ identityToken: "token", userId: ctx.testUserId })
      .expect(200);

    expect(answered.body).toEqual({ error: OAuthError.NotConfigured });
  });
});
