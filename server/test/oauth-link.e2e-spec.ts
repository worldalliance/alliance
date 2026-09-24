import {
  MOBILE_OAUTH_RETURN_URL,
  OAuthError,
  OAuthOutcome,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import { AppleOAuthClient } from "src/auth/oauth/apple-oauth.client";
import { GoogleOAuthClient } from "src/auth/oauth/google-oauth.client";
import { OAuthAccount } from "src/auth/oauth/oauth-account.entity";
import { mintProof, OAuthAuthService } from "src/auth/oauth/oauth-auth.service";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { JWTTokenType } from "src/auth/tokens";
import { ReferralSource, User } from "src/user/entities/user.entity";
import request from "supertest";
import TestAgent from "supertest/lib/agent";
import {
  createTestApp,
  signAccessToken,
  signImpersonationToken,
  TestContext,
} from "./e2e-test-utils";

type Member = { id: number; email: string; accessToken: string };

describe("OAuth linking from the mobile app (e2e)", () => {
  let ctx: TestContext;
  let profile: OAuthProfile;
  let fresh = 0;

  const client = (): TestAgent => request.agent(ctx.app.getHttpServer());

  const path = (suffix: string): string =>
    `/auth/${profile.provider}/${suffix}`;

  const freshMember = async (): Promise<Member> => {
    const repository = ctx.dataSource.getRepository(User);
    const user = await repository.save(
      repository.create({
        email: `link-member-${fresh++}@example.com`,
        name: "Link Member",
        password: "pass",
        emailVerified: true,
        referralSource: ReferralSource.None,
      }),
    );
    return {
      id: user.id,
      email: user.email,
      accessToken: signAccessToken(ctx.jwtService, user),
    };
  };

  const connected = async (member: Member) =>
    (
      await ctx.dataSource
        .getRepository(OAuthAccount)
        .findBy({ userId: member.id })
    ).map(({ provider, subject, email }) => ({ provider, subject, email }));

  const linkNative = async (member: Member, userId = member.id) =>
    client()
      .post(path("link/native"))
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ identityToken: "valid", userId })
      .expect(200);

  const startBrowserSession = async (member: Member) => {
    const started = await client()
      .post(path("link/browser"))
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    return {
      proof: String(started.body.proof),
      state: new URL(started.body.url).searchParams.get("state"),
      returnTo: String(started.body.returnTo),
    };
  };

  /** A fresh agent: the system browser shares no cookies with the app. */
  const finishInBrowser = async (query: Record<string, unknown>) => {
    const finished = await client().get(path("callback")).query(query);
    expect(finished.headers.location.startsWith(MOBILE_OAUTH_RETURN_URL)).toBe(
      true,
    );
    expect(String(finished.headers["set-cookie"])).not.toContain(
      "access_token=",
    );
    return new URL(finished.headers.location).searchParams;
  };

  const redeem = async (params: {
    member: Member;
    handoff: string;
    proof: string;
  }) =>
    (
      await client()
        .post(path("link/redeem"))
        .set("Authorization", `Bearer ${params.member.accessToken}`)
        .send({ handoff: params.handoff, proof: params.proof })
        .expect(200)
    ).body;

  const linkInBrowser = async (member: Member) => {
    const { proof, state } = await startBrowserSession(member);
    const returned = await finishInBrowser({ code: "code", state });
    return { proof, handoff: String(returned.get("handoff")), returned };
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
  }, 50000);

  beforeEach(() => {
    profile = {
      provider: OAuthProvider.Google,
      subject: `link-subject-${fresh}`,
      email: "someone-else@example.com",
      emailVerified: true,
      name: "Provider Name",
    };
  });

  it("refuses an admin impersonating the member on every route", async () => {
    const member = await freshMember();
    const impersonated = `Bearer ${signImpersonationToken(ctx.jwtService, member)}`;

    await client()
      .post(path("link/native"))
      .set("Authorization", impersonated)
      .send({ identityToken: "valid", userId: member.id })
      .expect(403);
    await client()
      .post(path("link/browser"))
      .set("Authorization", impersonated)
      .expect(403);
    const { proof, handoff } = await linkInBrowser(member);
    await client()
      .post(path("link/redeem"))
      .set("Authorization", impersonated)
      .send({ handoff, proof })
      .expect(403);

    expect(await connected(member)).toEqual([]);
  });

  describe("with a native id token", () => {
    it("connects an identity whose address differs and keeps the member's", async () => {
      const member = await freshMember();

      const linked = await linkNative(member);

      expect(linked.body.user.id).toBe(member.id);
      expect(linked.body.user.email).toBe(member.email);
      expect(linked.body.user.oauthAccounts).toEqual([
        { provider: OAuthProvider.Google, email: profile.email },
      ]);
      expect(linked.body).not.toHaveProperty("session");
      expect(String(linked.headers["set-cookie"])).not.toContain(
        "access_token=",
      );
      await client()
        .get("/auth/me")
        .set("Authorization", `Bearer ${member.accessToken}`)
        .expect(200);
    });

    it("succeeds again for the identity already connected", async () => {
      const member = await freshMember();
      await linkNative(member);

      const again = await linkNative(member);

      expect(again.body.error).toBeUndefined();
      expect(await connected(member)).toHaveLength(1);
    });

    it("refuses an identity another member has connected", async () => {
      const owner = await freshMember();
      await linkNative(owner);
      const member = await freshMember();

      const linked = await linkNative(member);

      expect(linked.body).toEqual({
        error: OAuthError.ClaimedByAnotherAccount,
      });
      expect(await connected(member)).toEqual([]);
    });

    it("refuses an address the provider has not verified", async () => {
      const member = await freshMember();
      profile = { ...profile, emailVerified: false };

      expect((await linkNative(member)).body).toEqual({
        error: OAuthError.EmailNotVerified,
      });
      expect(await connected(member)).toEqual([]);
    });

    it("keeps the first identity when a second from the same provider arrives", async () => {
      const member = await freshMember();
      await linkNative(member);
      const first = await connected(member);
      profile = { ...profile, subject: `${profile.subject}-second` };

      expect((await linkNative(member)).body).toEqual({
        error: OAuthError.ProviderAlreadyConnected,
      });
      expect(await connected(member)).toEqual(first);
    });

    it("refuses when a different member is signed in than the app started for", async () => {
      const member = await freshMember();
      const other = await freshMember();

      expect((await linkNative(member, other.id)).body).toEqual({
        error: OAuthError.Failed,
      });
      expect(await connected(member)).toEqual([]);
      expect(await connected(other)).toEqual([]);
    });

    it("fails a token the provider did not sign", async () => {
      const member = await freshMember();

      const linked = await client()
        .post(path("link/native"))
        .set("Authorization", `Bearer ${member.accessToken}`)
        .send({ identityToken: "forged", userId: member.id })
        .expect(200);

      expect(linked.body).toEqual({ error: OAuthError.Failed });
    });

    it("requires a signed-in member", async () => {
      await client()
        .post(path("link/native"))
        .send({ identityToken: "valid", userId: 1 })
        .expect(401);
    });
  });

  describe("through a browser session", () => {
    it("requires a signed-in member to start", async () => {
      await client().post(path("link/browser")).expect(401);
    });

    it("writes nothing until the app redeems, then connects", async () => {
      const member = await freshMember();

      const { proof, handoff } = await linkInBrowser(member);
      expect(await connected(member)).toEqual([]);

      const redeemed = await redeem({ member, handoff, proof });
      expect(redeemed.user.oauthAccounts).toEqual([
        { provider: OAuthProvider.Google, email: profile.email },
      ]);
      expect(await connected(member)).toEqual([
        {
          provider: OAuthProvider.Google,
          subject: profile.subject,
          email: profile.email,
        },
      ]);
    });

    it("links only for the proof that started it", async () => {
      const member = await freshMember();
      const { proof, handoff } = await linkInBrowser(member);

      expect(
        await redeem({ member, handoff, proof: mintProof().proof }),
      ).toEqual({ error: OAuthError.Failed });

      expect((await redeem({ member, handoff, proof })).user.id).toBe(
        member.id,
      );
    });

    it("refuses a member other than the one who started it", async () => {
      const member = await freshMember();
      const other = await freshMember();
      const { proof, handoff } = await linkInBrowser(member);

      expect(await redeem({ member: other, handoff, proof })).toEqual({
        error: OAuthError.Failed,
      });
      expect(await connected(other)).toEqual([]);

      expect((await redeem({ member, handoff, proof })).user.id).toBe(
        member.id,
      );
    });

    it("redeems a handoff once", async () => {
      const member = await freshMember();
      const { proof, handoff } = await linkInBrowser(member);
      await redeem({ member, handoff, proof });

      expect(await redeem({ member, handoff, proof })).toEqual({
        error: OAuthError.Failed,
      });
    });

    it("is not a way to sign in", async () => {
      const member = await freshMember();
      const { proof, handoff } = await linkInBrowser(member);

      const signIn = await client()
        .post(path("native/redeem"))
        .send({ handoff, proof })
        .expect(200);

      expect(signIn.body).toEqual({ error: OAuthError.Failed });
    });

    it("does not redeem a sign-in handoff as a link", async () => {
      const member = await freshMember();
      const { proof, proofHash } = mintProof();
      const handoff = await ctx.app.get(OAuthAuthService).signHandoff({
        userId: member.id,
        provider: profile.provider,
        outcome: OAuthOutcome.SignedIn,
        proofHash,
      });

      expect(await redeem({ member, handoff, proof })).toEqual({
        error: OAuthError.Failed,
      });
      expect(await connected(member)).toEqual([]);
    });

    it("keeps the identity unreadable in the return link", async () => {
      const member = await freshMember();

      const { handoff } = await linkInBrowser(member);

      const claims = JSON.stringify(ctx.jwtService.decode(handoff));
      expect(claims).not.toContain(profile.email);
      expect(claims).not.toContain(profile.subject);
    });

    it("sends a conflict back to the app at the callback", async () => {
      const owner = await freshMember();
      await linkNative(owner);
      const member = await freshMember();

      const { returned } = await linkInBrowser(member);

      expect(returned.get("error")).toBe(OAuthError.ClaimedByAnotherAccount);
      expect(returned.get("handoff")).toBeNull();
    });

    it("keeps an identity connected between the callback and redeem", async () => {
      const member = await freshMember();
      const { proof, handoff } = await linkInBrowser(member);
      profile = { ...profile, subject: `${profile.subject}-native` };
      await linkNative(member);
      const first = await connected(member);

      expect(await redeem({ member, handoff, proof })).toEqual({
        error: OAuthError.ProviderAlreadyConnected,
      });
      expect(await connected(member)).toEqual(first);
    });

    it("refuses at redeem an identity another member connected since the callback", async () => {
      const member = await freshMember();
      const { proof, handoff } = await linkInBrowser(member);
      await linkNative(await freshMember());

      expect(await redeem({ member, handoff, proof })).toEqual({
        error: OAuthError.ClaimedByAnotherAccount,
      });
      expect(await connected(member)).toEqual([]);
    });

    it("sends a cancellation back to the app", async () => {
      const member = await freshMember();
      const { state } = await startBrowserSession(member);

      const returned = await finishInBrowser({ error: "access_denied", state });

      expect(returned.get("error")).toBe(OAuthError.Cancelled);
    });

    it("refuses an expired handoff as expired", async () => {
      const member = await freshMember();
      const { proof, proofHash } = mintProof();
      const { identity } = ctx.jwtService.decode<{ identity: string }>(
        await ctx.app.get(OAuthAuthService).signLinkHandoff({
          userId: member.id,
          provider: profile.provider,
          subject: profile.subject,
          email: profile.email,
          proofHash,
        }),
      );
      const handoff = ctx.jwtService.sign(
        {
          tokenType: JWTTokenType.oauthLinkHandoff,
          userId: member.id,
          provider: profile.provider,
          identity,
          proofHash,
        },
        { expiresIn: -60 },
      );

      expect(await redeem({ member, handoff, proof })).toEqual({
        error: OAuthError.Expired,
      });
    });
  });
});
