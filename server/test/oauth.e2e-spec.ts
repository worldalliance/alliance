import {
  OAuthError,
  OAuthIntent,
  OAuthOutcome,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import { BadRequestException } from "@nestjs/common";
import { AuthService } from "src/auth/auth.service";
import { AppleOAuthClient } from "src/auth/oauth/apple-oauth.client";
import { GoogleOAuthClient } from "src/auth/oauth/google-oauth.client";
import { OAuthAuthService } from "src/auth/oauth/oauth-auth.service";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { GUEST_COOKIE } from "src/auth/tokens";
import { ReferralSource, User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import request from "supertest";
import TestAgent from "supertest/lib/agent";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

const RETURN_TO = "http://localhost:5173/login";
const FRESH_MEMBER_PASSWORD = "pass";

describe("OAuth sign-in (e2e)", () => {
  let ctx: TestContext;
  let profile: OAuthProfile;
  let fresh = 0;

  const client = (): TestAgent => request.agent(ctx.app.getHttpServer());

  const outcomeOf = (location: string): string | null =>
    new URL(location).searchParams.get(profile.provider);

  const errorOf = (location: string): string | null =>
    new URL(location).searchParams.get(`${profile.provider}Error`);

  const stateOf = (consentUrl: string): string | null =>
    new URL(consentUrl).searchParams.get("state");

  const claimsOf = (state: string | null): unknown =>
    JSON.parse(Buffer.from(String(state).split(".")[1], "base64").toString());

  const path = (suffix: string): string =>
    `/auth/${profile.provider}/${suffix}`;

  /**
   * A member with nothing connected. One account per provider now, so a test
   * that links has to start from someone who has not linked already.
   */
  const freshMember = async (
    overrides: Partial<User> = {},
  ): Promise<{ id: number; email: string; accessToken: string }> => {
    const repository = ctx.dataSource.getRepository(User);
    const user = await repository.save(
      repository.create({
        email: `member-${fresh++}@example.com`,
        name: "Fresh Member",
        password: FRESH_MEMBER_PASSWORD,
        emailVerified: true,
        referralSource: ReferralSource.None,
        ...overrides,
      }),
    );
    return {
      id: user.id,
      email: user.email,
      accessToken: signAccessToken(ctx.jwtService, user),
    };
  };

  const linkedEmails = (user: {
    oauthAccounts: { provider: string; email: string }[];
  }): Record<string, string> =>
    Object.fromEntries(user.oauthAccounts.map((a) => [a.provider, a.email]));

  /** One agent throughout: the cookie from the start call binds the flow. */
  const signIn = async (params: { referralCode?: string } = {}) => {
    const agent = client();
    const started = await agent.get(path("start")).query({
      intent: OAuthIntent.Authenticate,
      returnTo: RETURN_TO,
      ...(params.referralCode && { referralCode: params.referralCode }),
    });
    const finished = await agent
      .get(path("callback"))
      .query({ code: "code", state: stateOf(started.headers.location) });
    return { agent, started, finished };
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    for (const oauth of [
      ctx.app.get(GoogleOAuthClient),
      ctx.app.get(AppleOAuthClient),
    ]) {
      oauth.authorizationUrl = ({ state }) =>
        `https://consent.example.com/?state=${state}`;
      oauth.exchangeCode = () => Promise.resolve(R.success(profile));
      oauth.verifyIdentityToken = (token) =>
        Promise.resolve(
          token === "valid"
            ? R.success(profile)
            : R.failure(new Error("bad token")),
        );
    }
    await ctx.dataSource
      .getRepository(User)
      .update(ctx.testUserId, { emailVerified: true });
  }, 50000);

  beforeEach(() => {
    profile = {
      provider: OAuthProvider.Google,
      subject: "google-user",
      email: "user@example.com",
      emailVerified: true,
      name: "Test User",
    };
  });

  describe("provider", () => {
    it("refuses one it does not know", async () => {
      await client()
        .get("/auth/facebook/start")
        .query({ intent: OAuthIntent.Authenticate, returnTo: RETURN_TO })
        .expect(400);
    });

    it("refuses a state minted for another provider", async () => {
      const started = await client()
        .get("/auth/google/start")
        .query({ intent: OAuthIntent.Authenticate, returnTo: RETURN_TO });

      const finished = await client()
        .get("/auth/apple/callback")
        .query({ code: "code", state: stateOf(started.headers.location) });

      expect(
        new URL(finished.headers.location).searchParams.get("appleError"),
      ).toBe(OAuthError.Failed);
    });
  });

  describe("returnTo", () => {
    it("refuses an origin that is not ours", async () => {
      await client()
        .get(path("start"))
        .query({
          intent: OAuthIntent.Authenticate,
          returnTo: "http://evil.example.com/x",
        })
        .expect(400);
    });

    // The Host header is the caller's to choose, so an origin only it claims
    // is not ours.
    it("refuses an origin that only the Host header claims", async () => {
      await client()
        .get(path("start"))
        .set("Host", "evil.example.com")
        .query({
          intent: OAuthIntent.Authenticate,
          returnTo: "http://evil.example.com/x",
        })
        .expect(400);
    });

    it("refuses a deep link that only shares the app's scheme", async () => {
      await client()
        .get(path("start"))
        .query({
          intent: OAuthIntent.Authenticate,
          returnTo: "alliance://auth/evil",
        })
        .expect(400);
    });
  });

  describe("the browser that started the flow", () => {
    it("signs in and lands back where it came from", async () => {
      const { finished } = await signIn();

      expect(finished.headers.location.startsWith(RETURN_TO)).toBe(true);
      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
      expect(String(finished.headers["set-cookie"])).toContain("access_token=");
    });

    // Apple answers with a cross-site form post, which the lax cookie does not
    // accompany, so the callback bounces it to a GET on the same URL.
    it("finishes an Apple form post the same way", async () => {
      profile = {
        ...profile,
        provider: OAuthProvider.Apple,
        subject: "apple-user",
      };
      const agent = client();
      const started = await agent.get(path("start")).query({
        intent: OAuthIntent.Authenticate,
        returnTo: RETURN_TO,
      });
      const posted = await agent
        .post(path("callback"))
        .type("form")
        .send({
          code: "code",
          state: stateOf(started.headers.location),
          user: JSON.stringify({ name: { firstName: "Ada" } }),
        })
        .expect(303);
      expect(posted.headers.location.startsWith("?")).toBe(true);
      // The name Apple sends once must not reach the URL, where nginx's access
      // log and the request log would both write it down.
      expect(posted.headers.location).not.toContain("Ada");
      expect(String(posted.headers["set-cookie"])).toContain(
        "oauth_apple_user=",
      );

      const finished = await agent.get(
        `${path("callback")}${posted.headers.location}`,
      );

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
      expect(String(finished.headers["set-cookie"])).toContain("access_token=");
    });

    // Otherwise an attacker finishes their own consent, hands the callback url
    // to a member, and that member's browser is signed into their account.
    it("is the only one that can finish it", async () => {
      const started = await client().get(path("start")).query({
        intent: OAuthIntent.Authenticate,
        returnTo: RETURN_TO,
      });

      const elsewhere = await client()
        .get(path("callback"))
        .query({ code: "code", state: stateOf(started.headers.location) });

      expect(errorOf(elsewhere.headers.location)).toBe(OAuthError.Failed);
      expect(String(elsewhere.headers["set-cookie"])).not.toContain(
        "access_token=",
      );
    });

    // The state travels to the provider in a query string and a JWT hides
    // nothing, so no credential may ride in it.
    it("keeps the guest token out of the state", async () => {
      const { guestToken } = await ctx.app
        .get(AuthService)
        .createGuestSession();

      const started = await client()
        .get(path("start"))
        .set("Cookie", `${GUEST_COOKIE}=${guestToken}`)
        .query({ intent: OAuthIntent.Authenticate, returnTo: RETURN_TO });

      expect(claimsOf(stateOf(started.headers.location))).not.toHaveProperty(
        "guestToken",
      );
    });

    // One cookie carries every flow this browser has open, so a member with the
    // login page in one tab and signup in another can finish either.
    it("still finishes the first tab's flow after a second tab starts one", async () => {
      const agent = client();
      const first = await agent.get(path("start")).query({
        intent: OAuthIntent.Authenticate,
        returnTo: RETURN_TO,
      });
      await agent.get(path("start")).query({
        intent: OAuthIntent.Authenticate,
        returnTo: RETURN_TO,
      });

      const finished = await agent
        .get(path("callback"))
        .query({ code: "code", state: stateOf(first.headers.location) });

      expect(errorOf(finished.headers.location)).toBeNull();
      expect(String(finished.headers["set-cookie"])).toContain("access_token=");
    });

    it("cannot finish the same flow twice", async () => {
      const { agent, started, finished } = await signIn();
      expect(errorOf(finished.headers.location)).toBeNull();

      const replayed = await agent.get(path("callback")).query({
        code: "code",
        state: stateOf(started.headers.location),
      });

      expect(errorOf(replayed.headers.location)).toBe(OAuthError.Failed);
    });
  });

  describe("linking", () => {
    let member: { id: number; email: string; accessToken: string };

    beforeEach(async () => {
      member = await freshMember();
      profile = {
        ...profile,
        subject: `linkable-${member.id}`,
        email: "user@example.com",
      };
    });

    it("writes straight away for the browser that started the flow", async () => {
      const agent = client();
      const started = await agent
        .get(path("start"))
        .set("Authorization", `Bearer ${member.accessToken}`)
        .query({ intent: OAuthIntent.Link, returnTo: RETURN_TO });
      const finished = await agent.get(path("callback")).query({
        code: "code",
        state: stateOf(started.headers.location),
      });

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
      const me = await client()
        .get("/auth/me")
        .set("Authorization", `Bearer ${member.accessToken}`)
        .expect(200);
      expect(linkedEmails(me.body.user).google).toBe("user@example.com");
    });

    // A throw would otherwise reach the member as an exception filter's JSON,
    // mid-navigation, with no way back to the app.
    it("sends the member back when the write throws", async () => {
      const oauth = ctx.app.get(OAuthAuthService);
      const link = oauth.link.bind(oauth);
      oauth.link = () => Promise.reject(new Error("boom"));

      try {
        const agent = client();
        const started = await agent
          .get(path("start"))
          .set("Authorization", `Bearer ${member.accessToken}`)
          .query({ intent: OAuthIntent.Link, returnTo: RETURN_TO });
        const finished = await agent.get(path("callback")).query({
          code: "code",
          state: stateOf(started.headers.location),
        });

        expect(finished.status).toBe(302);
        expect(errorOf(finished.headers.location)).toBe(OAuthError.Failed);
      } finally {
        oauth.link = link;
      }
    });
  });

  // Registering does not confirm the address, so an account claiming one is not
  // evidence that its owner made it.
  describe("an account someone else may have registered", () => {
    const login = (email: string) =>
      client()
        .post("/auth/login")
        .send({ email, password: FRESH_MEMBER_PASSWORD, mode: "cookie" });

    it("hands it to the address's owner and retires the unproven password", async () => {
      const squatted = await freshMember({ emailVerified: false });
      profile = { ...profile, subject: "squatted", email: squatted.email };

      const { finished } = await signIn();

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
      expect(String(finished.headers["set-cookie"])).toContain("access_token=");
      const taken = await ctx.dataSource
        .getRepository(User)
        .findOneByOrFail({ id: squatted.id });
      expect(taken.password).toBeNull();
      expect(taken.emailVerified).toBe(true);
      // Whoever registered the address holds no way in once it changes hands.
      await login(squatted.email).expect(401);
    });

    it("leaves the password alone once the address is confirmed", async () => {
      const member = await freshMember({ emailVerified: true });
      profile = { ...profile, subject: "confirmed", email: member.email };

      const { finished } = await signIn();

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
      await login(member.email).expect(200);
    });

    // The payment flow leaves an account with no password and an address it
    // never confirmed, which the reset link used to be the only way out of.
    it("finishes signing up a partial profile from a payment", async () => {
      const email = "paid-then-signed-in@example.com";
      const partial = await ctx.app
        .get(UserService)
        .createPartialProfile({ email, firstName: "Paid", lastName: "First" });
      profile = { ...profile, subject: "paid-first", email };

      const { finished } = await signIn();

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
      const completed = await ctx.dataSource
        .getRepository(User)
        .findOneByOrFail({ id: partial.id });
      expect(completed.isNotSignedUpPartialProfile).toBe(false);
      expect(completed.emailVerified).toBe(true);
    });
  });

  describe("a second account from one provider", () => {
    it("is refused rather than replacing the first", async () => {
      const member = await freshMember();
      profile = { ...profile, subject: "first", email: member.email };
      await signIn();

      profile = { ...profile, subject: "second" };
      const { finished } = await signIn();

      expect(errorOf(finished.headers.location)).toBe(
        OAuthError.ProviderAlreadyConnected,
      );
    });

    // The bug this pins: the upsert used to overwrite the subject, and the
    // account already connected stopped resolving to anyone.
    it("leaves the first one still able to sign in", async () => {
      const member = await freshMember();
      profile = { ...profile, subject: "keeps-working", email: member.email };
      await signIn();

      profile = { ...profile, subject: "usurper" };
      await signIn();

      profile = { ...profile, subject: "keeps-working" };
      const { finished } = await signIn();

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.SignedIn);
    });
  });

  describe("an account that does not exist yet", () => {
    beforeEach(() => {
      profile = {
        ...profile,
        subject: "stranger",
        email: "stranger@example.com",
      };
    });

    it("is turned away without an invite", async () => {
      const { finished } = await signIn();

      expect(errorOf(finished.headers.location)).toBe(OAuthError.NoAccount);
    });

    // A spent invite throws from inside the signup path, where an exception has
    // nowhere to go but the member's screen.
    it("is sent back with a reason when the invite does not resolve", async () => {
      const authService = ctx.app.get(AuthService);
      const create = authService.createReferredUser.bind(authService);
      authService.createReferredUser = () =>
        Promise.reject(
          new BadRequestException("This invite code has already been used"),
        );

      try {
        const { finished } = await signIn({ referralCode: "spent" });

        expect(finished.status).toBe(302);
        expect(errorOf(finished.headers.location)).toBe(
          OAuthError.InviteRequired,
        );
      } finally {
        authService.createReferredUser = create;
      }
    });
  });

  describe("unlinking", () => {
    /** Signed up through a provider, so the column holds no password. */
    const passwordless = async (email: string): Promise<string> => {
      profile = { ...profile, subject: `passwordless-${email}`, email };
      await signIn({ referralCode: "any" });
      const user = await ctx.dataSource
        .getRepository(User)
        .findOneByOrFail({ email });
      expect(user.password).toBeNull();
      return signAccessToken(ctx.jwtService, user);
    };

    it("refuses while the provider is the only way in", async () => {
      const accessToken = await passwordless("only-way-in@example.com");

      await client()
        .delete(path("link"))
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);
    });

    it("allows it once another provider is linked", async () => {
      const email = "two-ways-in@example.com";
      const accessToken = await passwordless(email);

      const agent = client();
      profile = {
        ...profile,
        provider: OAuthProvider.Apple,
        subject: "second-way-in",
      };
      const started = await agent
        .get(path("start"))
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ intent: OAuthIntent.Link, returnTo: RETURN_TO });
      await agent.get(path("callback")).query({
        code: "code",
        state: stateOf(started.headers.location),
      });

      const unlinked = await client()
        .delete("/auth/google/link")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(linkedEmails(unlinked.body.user)).toEqual({ apple: email });
    });
  });
});
