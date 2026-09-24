import {
  MOBILE_OAUTH_RETURN_URL,
  OAuthError,
  OAuthIntent,
  OAuthOutcome,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import { BadRequestException } from "@nestjs/common";
import { AuthService } from "src/auth/auth.service";
import { Guest } from "src/auth/entities/guest.entity";
import { AppleOAuthClient } from "src/auth/oauth/apple-oauth.client";
import { GoogleOAuthClient } from "src/auth/oauth/google-oauth.client";
import { mintProof, OAuthAuthService } from "src/auth/oauth/oauth-auth.service";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { SpentTokenService } from "src/auth/spent-token.service";
import { GUEST_COOKIE, JWTTokenType } from "src/auth/tokens";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import request from "supertest";
import TestAgent from "supertest/lib/agent";
import {
  createTestApp,
  signAccessToken,
  signImpersonationToken,
  TestContext,
} from "./e2e-test-utils";

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

  const linkInBrowser = async (accessToken: string) => {
    const agent = client();
    const started = await agent
      .get(path("start"))
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ intent: OAuthIntent.Link, returnTo: RETURN_TO });
    return agent
      .get(path("callback"))
      .query({ code: "code", state: stateOf(started.headers.location) });
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

  describe("timeZone", () => {
    it.each(["not-a-zone", "-08:00"])("refuses %p", async (timeZone) => {
      await client()
        .get(path("start"))
        .query({
          intent: OAuthIntent.Authenticate,
          returnTo: RETURN_TO,
          timeZone,
        })
        .expect(400);
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

    it("sends an expired flow to the web login rather than the app", async () => {
      const agent = client();
      const started = await agent.get(path("start")).query({
        intent: OAuthIntent.Authenticate,
        returnTo: RETURN_TO,
      });
      const {
        exp: _exp,
        iat: _iat,
        ...claims
      } = claimsOf(stateOf(started.headers.location)) as Record<
        string,
        unknown
      >;

      const finished = await agent.get(path("callback")).query({
        code: "code",
        state: ctx.jwtService.sign(claims, { expiresIn: -60 }),
      });

      expect(
        finished.headers.location.startsWith(MOBILE_OAUTH_RETURN_URL),
      ).toBe(false);
      expect(errorOf(finished.headers.location)).toBe(OAuthError.Failed);
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
      const finished = await linkInBrowser(member.accessToken);

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
      const me = await client()
        .get("/auth/me")
        .set("Authorization", `Bearer ${member.accessToken}`)
        .expect(200);
      expect(linkedEmails(me.body.user).google).toBe("user@example.com");
    });

    it("refuses to start for an admin impersonating the member", async () => {
      await client()
        .get(path("start"))
        .set(
          "Authorization",
          `Bearer ${signImpersonationToken(ctx.jwtService, member)}`,
        )
        .query({ intent: OAuthIntent.Link, returnTo: RETURN_TO })
        .expect(403);
    });

    // A throw would otherwise reach the member as an exception filter's JSON,
    // mid-navigation, with no way back to the app.
    it("sends the member back when the write throws", async () => {
      const oauth = ctx.app.get(OAuthAuthService);
      const link = oauth.link.bind(oauth);
      oauth.link = () => Promise.reject(new Error("boom"));

      try {
        const finished = await linkInBrowser(member.accessToken);

        expect(finished.status).toBe(302);
        expect(errorOf(finished.headers.location)).toBe(OAuthError.Failed);
      } finally {
        oauth.link = link;
      }
    });
  });

  describe("an existing account with the provider's address", () => {
    const login = (email: string) =>
      client()
        .post("/auth/login")
        .send({ email, password: FRESH_MEMBER_PASSWORD, mode: "cookie" });

    it.each([false, true])(
      "keeps the password when emailVerified is %p",
      async (emailVerified) => {
        const member = await freshMember({ emailVerified });
        profile = {
          ...profile,
          subject: `existing-${member.id}`,
          email: member.email,
        };

        const { finished } = await signIn();

        expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.Linked);
        const linked = await ctx.dataSource
          .getRepository(User)
          .findOneByOrFail({ id: member.id });
        expect(linked.emailVerified).toBe(true);
        await login(member.email).expect(200);
      },
    );

    it.each(["_", "%"])(
      "is not linked from an address with %p in its place",
      async (wildcard) => {
        const member = await freshMember({ emailVerified: false });
        profile = {
          ...profile,
          subject: `pattern-${member.id}`,
          email: member.email.replace("-", wildcard),
        };

        const { finished } = await signIn();

        expect(errorOf(finished.headers.location)).toBe(OAuthError.NoAccount);
        const untouched = await ctx.dataSource
          .getRepository(User)
          .findOneOrFail({
            where: { id: member.id },
            relations: { oauthAccounts: true },
          });
        expect(untouched.emailVerified).toBe(false);
        expect(untouched.oauthAccounts).toEqual([]);
      },
    );
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

    it("is created by an invite that resolves, with the provider connected", async () => {
      const inviter = await freshMember();
      const invites = ctx.dataSource.getRepository(OnetimeInvite);
      const invite = await invites.save(
        invites.create({
          invitee: "invited@example.com",
          code: `invite-${inviter.id}`,
          status: OnetimeInviteStatus.LINK_UNUSED,
          invitingUser: { id: inviter.id },
        }),
      );
      profile = { ...profile, subject: "invited", email: invite.invitee };

      const { finished } = await signIn({ referralCode: invite.code });

      expect(outcomeOf(finished.headers.location)).toBe(OAuthOutcome.SignedUp);
      const created = await ctx.dataSource.getRepository(User).findOneOrFail({
        where: { email: profile.email },
        relations: {
          oauthAccounts: true,
          referredBy: true,
          referredByInvite: true,
        },
      });
      expect(created.referredBy?.id).toBe(inviter.id);
      expect(created.referredByInvite?.id).toBe(invite.id);
      expect(created.emailVerified).toBe(true);
      expect(created.oauthAccounts).toMatchObject([
        { provider: profile.provider, email: profile.email },
      ]);
      const spent = await invites.findOneByOrFail({ id: invite.id });
      expect(spent.status).toBe(OnetimeInviteStatus.LINK_USED);
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

    it("refuses an admin impersonating the member", async () => {
      const member = await freshMember();
      profile = { ...profile, subject: `impersonated-${member.id}` };
      await linkInBrowser(member.accessToken);

      await client()
        .delete(path("link"))
        .set(
          "Authorization",
          `Bearer ${signImpersonationToken(ctx.jwtService, member)}`,
        )
        .expect(403);

      const me = await client()
        .get("/auth/me")
        .set("Authorization", `Bearer ${member.accessToken}`)
        .expect(200);
      expect(linkedEmails(me.body.user).google).toBe(profile.email);
    });

    it("allows it once another provider is linked", async () => {
      const email = "two-ways-in@example.com";
      const accessToken = await passwordless(email);

      profile = {
        ...profile,
        provider: OAuthProvider.Apple,
        subject: "second-way-in",
      };
      await linkInBrowser(accessToken);

      const unlinked = await client()
        .delete("/auth/google/link")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(linkedEmails(unlinked.body.user)).toEqual({ apple: email });
    });

    // One pair of requests doesn't always overlap, so this tries several.
    it("keeps one way in when both providers are disconnected at once", async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const member = await freshMember({ password: null });
        for (const provider of Object.values(OAuthProvider)) {
          profile = {
            ...profile,
            provider,
            subject: `both-at-once-${provider}-${member.id}`,
          };
          await linkInBrowser(member.accessToken);
        }

        const statuses = await Promise.all(
          Object.values(OAuthProvider).map(async (provider) => {
            const res = await client()
              .delete(`/auth/${provider}/link`)
              .set("Authorization", `Bearer ${member.accessToken}`);
            return res.status;
          }),
        );

        expect(statuses.sort()).toEqual([200, 400]);
      }
    });
  });
  describe("the mobile app", () => {
    const users = () => ctx.dataSource.getRepository(User);

    const nativeSignIn = async (identityToken = "valid") =>
      (await client().post(path("native")).send({ identityToken }).expect(200))
        .body;

    const sessionUser = async (accessToken: string) =>
      (
        await client()
          .get("/auth/me")
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body.user;

    describe("with a native id token", () => {
      it("signs in to the account the identity is connected to", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `native-${member.id}`,
          email: member.email,
        };
        await nativeSignIn();

        // Apple hides the address behind a relay whenever the member asks,
        // and a connected identity still gets in.
        profile = { ...profile, email: "relay@privaterelay.appleid.com" };
        const signedIn = await nativeSignIn();

        expect((await sessionUser(signedIn.session.access_token)).id).toBe(
          member.id,
        );
      });

      it("accepts an id token it has already accepted", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `native-again-${member.id}`,
          email: member.email,
        };
        await nativeSignIn();

        const signedIn = await nativeSignIn();

        expect((await sessionUser(signedIn.session.access_token)).id).toBe(
          member.id,
        );
      });

      it("connects a verified address that matches and signs in", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `native-match-${member.id}`,
          email: member.email,
        };

        const signedIn = await nativeSignIn();

        const user = await sessionUser(signedIn.session.access_token);
        expect(user.id).toBe(member.id);
        expect(linkedEmails(user)).toEqual({ google: member.email });
      });

      it("refuses an address the provider has not verified", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `native-unverified-${member.id}`,
          email: member.email,
          emailVerified: false,
        };

        expect(await nativeSignIn()).toEqual({
          error: OAuthError.EmailNotVerified,
        });
      });

      it("turns away an address with no account and creates none", async () => {
        profile = {
          ...profile,
          subject: "native-stranger",
          email: "native-stranger@example.com",
        };

        expect(await nativeSignIn()).toEqual({ error: OAuthError.NoAccount });
        expect(await users().findOneBy({ email: profile.email })).toBeNull();
      });

      it("merges the guest the app carried into the member", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `native-guest-${member.id}`,
          email: member.email,
        };
        const { guestId, guestToken } = await ctx.app
          .get(AuthService)
          .createGuestSession();

        await client()
          .post(path("native"))
          .send({ identityToken: "valid", guestToken })
          .expect(200);

        const guest = await ctx.dataSource.getRepository(Guest).findOneOrFail({
          where: { id: guestId },
          relations: { linkedUser: true },
        });
        expect(guest.linkedUser?.id).toBe(member.id);
      });

      it("reports a second identity from a provider the account already has", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `native-first-${member.id}`,
          email: member.email,
        };
        await nativeSignIn();

        profile = { ...profile, subject: `native-second-${member.id}` };

        expect(await nativeSignIn()).toEqual({
          error: OAuthError.ProviderAlreadyConnected,
        });
      });

      it("fails a token the provider did not sign", async () => {
        expect(await nativeSignIn("forged")).toEqual({
          error: OAuthError.Failed,
        });
      });
    });

    describe("through a browser session", () => {
      const startBrowserSession = async () => {
        const started = await client().post(path("native/browser")).expect(200);
        return {
          proof: String(started.body.proof),
          state: stateOf(started.body.url),
        };
      };

      /** A fresh agent: the system browser shares no cookies with the app. */
      const finishInBrowser = async (query: Record<string, unknown>) => {
        const finished = await client().get(path("callback")).query(query);
        expect(
          finished.headers.location.startsWith(MOBILE_OAUTH_RETURN_URL),
        ).toBe(true);
        expect(String(finished.headers["set-cookie"])).not.toContain(
          "access_token=",
        );
        return new URL(finished.headers.location).searchParams;
      };

      const redeem = async (params: { handoff: string; proof: string }) =>
        (await client().post(path("native/redeem")).send(params).expect(200))
          .body;

      it("hands the session only to the proof that started it", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `browser-${member.id}`,
          email: member.email,
        };
        const { proof, state } = await startBrowserSession();
        const returned = await finishInBrowser({ code: "code", state });
        const handoff = String(returned.get("handoff"));

        // Another app can register the same scheme and catch the deep link.
        expect(await redeem({ handoff, proof: mintProof().proof })).toEqual({
          error: OAuthError.Failed,
        });

        const redeemed = await redeem({ handoff, proof });
        expect((await sessionUser(redeemed.session.access_token)).id).toBe(
          member.id,
        );
      });

      it("finishes an Apple form post", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          provider: OAuthProvider.Apple,
          subject: `apple-browser-${member.id}`,
          email: member.email,
        };
        const { proof, state } = await startBrowserSession();
        const browser = client();
        const posted = await browser
          .post(path("callback"))
          .type("form")
          .send({ code: "code", state })
          .expect(303);

        const finished = await browser.get(
          `${path("callback")}${posted.headers.location}`,
        );
        expect(
          finished.headers.location.startsWith(MOBILE_OAUTH_RETURN_URL),
        ).toBe(true);
        const handoff = String(
          new URL(finished.headers.location).searchParams.get("handoff"),
        );

        const redeemed = await redeem({ handoff, proof });
        expect((await sessionUser(redeemed.session.access_token)).id).toBe(
          member.id,
        );
      });

      it("redeems a handoff once", async () => {
        const member = await freshMember();
        profile = {
          ...profile,
          subject: `browser-replay-${member.id}`,
          email: member.email,
        };
        const { proof, state } = await startBrowserSession();
        const returned = await finishInBrowser({ code: "code", state });
        const handoff = String(returned.get("handoff"));

        const redeemed = await redeem({ handoff, proof });
        expect((await sessionUser(redeemed.session.access_token)).id).toBe(
          member.id,
        );

        expect(await redeem({ handoff, proof })).toEqual({
          error: OAuthError.Failed,
        });
      });

      it("comes back on the link it chose, whatever the caller asks for", async () => {
        const started = await client()
          .post(path("native/browser"))
          .send({ returnTo: "https://evil.example.com/mobile/oauth-callback" })
          .expect(200);

        expect(started.body.returnTo).toBe(MOBILE_OAUTH_RETURN_URL);
        expect(claimsOf(stateOf(started.body.url))).toMatchObject({
          returnTo: MOBILE_OAUTH_RETURN_URL,
        });
      });

      it("sends a cancellation back to the app", async () => {
        const { state } = await startBrowserSession();

        const returned = await finishInBrowser({
          error: "access_denied",
          state,
        });

        expect(returned.get("error")).toBe(OAuthError.Cancelled);
      });

      it("sends Apple's cancellation back to the app", async () => {
        profile = { ...profile, provider: OAuthProvider.Apple };
        const { state } = await startBrowserSession();

        const returned = await finishInBrowser({
          error: "user_cancelled_authorize",
          state,
        });

        expect(returned.get("error")).toBe(OAuthError.Cancelled);
      });

      it("sends any other provider error back to the app as a failure", async () => {
        const { state } = await startBrowserSession();

        const returned = await finishInBrowser({
          error: "server_error",
          state,
        });

        expect(returned.get("error")).toBe(OAuthError.Failed);
      });

      it("sends a missing account back to the app and creates none", async () => {
        profile = {
          ...profile,
          subject: "browser-stranger",
          email: "browser-stranger@example.com",
        };
        const { state } = await startBrowserSession();

        const returned = await finishInBrowser({ code: "code", state });

        expect(returned.get("error")).toBe(OAuthError.NoAccount);
        expect(await users().findOneBy({ email: profile.email })).toBeNull();
      });

      it("sends an expired flow back to the app", async () => {
        const { state } = await startBrowserSession();
        const {
          exp: _exp,
          iat: _iat,
          ...claims
        } = claimsOf(state) as Record<string, unknown>;
        const expired = ctx.jwtService.sign(claims, { expiresIn: -60 });

        const returned = await finishInBrowser({
          code: "code",
          state: expired,
        });

        expect(returned.get("error")).toBe(OAuthError.Expired);
      });

      it("refuses the state token the app also holds", async () => {
        const { proof, state } = await startBrowserSession();

        expect(await redeem({ handoff: String(state), proof })).toEqual({
          error: OAuthError.Failed,
        });
      });

      it("refuses a handoff minted for another provider", async () => {
        const { proof, proofHash } = mintProof();
        const handoff = ctx.jwtService.sign({
          tokenType: JWTTokenType.oauthHandoff,
          userId: ctx.testUserId,
          provider: OAuthProvider.Apple,
          outcome: OAuthOutcome.SignedIn,
          proofHash,
        });

        // `path` follows `profile.provider`, which is Google here.
        expect(await redeem({ handoff, proof })).toEqual({
          error: OAuthError.Failed,
        });
      });

      it("refuses an expired handoff as expired", async () => {
        const { proof, proofHash } = mintProof();
        const handoff = ctx.jwtService.sign(
          {
            tokenType: JWTTokenType.oauthHandoff,
            userId: ctx.testUserId,
            provider: profile.provider,
            outcome: OAuthOutcome.SignedIn,
            proofHash,
          },
          { expiresIn: -60 },
        );

        expect(await redeem({ handoff, proof })).toEqual({
          error: OAuthError.Expired,
        });
      });
    });
  });
  describe("spent credentials", () => {
    it("forgets one that has expired and holds on to one that has not", async () => {
      const spentTokens = ctx.app.get(SpentTokenService);
      await spentTokens.spend({
        credential: "still-alive",
        retainForMs: 60_000,
      });
      await spentTokens.spend({
        credential: "long-gone",
        retainForMs: -60_000,
      });

      await spentTokens.forgetExpired();

      expect(
        await spentTokens.spend({
          credential: "long-gone",
          retainForMs: 60_000,
        }),
      ).toBe(true);
      expect(
        await spentTokens.spend({
          credential: "still-alive",
          retainForMs: 60_000,
        }),
      ).toBe(false);
    });

    it("lets one of many concurrent spends through", async () => {
      const spentTokens = ctx.app.get(SpentTokenService);
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          spentTokens.spend({ credential: "raced", retainForMs: 60_000 }),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });
});
