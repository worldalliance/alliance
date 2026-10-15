import { AnalyticsEvent } from "@alliance/common/analytics";
import { NodeEnv } from "@alliance/common/node-env";
import {
  OAuthError,
  OAuthOutcome,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import {
  REVIEW_ACCOUNT_MESSAGE,
  REVIEW_SIGN_IN_FAILED_PARAM,
} from "@alliance/common/review-account";
import { io } from "socket.io-client";
import { TokenMode } from "src/auth/dto/signin.dto";
import { mintProof, OAuthAuthService } from "src/auth/oauth/oauth-auth.service";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "src/auth/tokens";
import { MailService } from "src/mail/mail.service";
import { MessagingModule } from "src/messaging/messaging.module";
import { PosthogService } from "src/posthog/posthog.service";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

const PASSWORD = "review-password";

describe("Review accounts (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let url: string;
  let emails = 0;
  const env = process.env.NODE_ENV;

  const server = () => ctx.app.getHttpServer();

  const runningAs = (nodeEnv: NodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
  };

  const createMember = (overrides: Partial<User> = {}): Promise<User> =>
    userRepo.save(
      userRepo.create({
        name: "Reviewer",
        email: `review-${emails++}@example.com`,
        password: PASSWORD,
        ...overrides,
      }),
    );

  const login = (email: string, password = PASSWORD) =>
    request(server())
      .post("/auth/login")
      .send({ email, password, mode: TokenMode.Header });

  const reviewLogin = (email: string, password = PASSWORD) =>
    request(server())
      .post("/auth/review-login")
      .type("form")
      .send({ email, password });

  const me = (token: string) =>
    request(server()).get("/auth/me").set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    userRepo = ctx.dataSource.getRepository(User);
    await ctx.app.listen(0);
    url = await ctx.app.getUrl();
  }, 50000);

  afterEach(() => {
    process.env.NODE_ENV = env;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    ctx.app.getHttpServer().closeAllConnections();
    await ctx.app.close();
  });

  describe("in production", () => {
    beforeEach(() => runningAs(NodeEnv.Production));

    it("sends a review account's password sign-in to staging without a session", async () => {
      const reviewer = await createMember({ isTestUser: true });

      const res = await login(reviewer.email).expect(403);

      expect(res.body.message).toBe(REVIEW_ACCOUNT_MESSAGE);
      expect(res.body.access_token).toBeUndefined();
      expect(String(res.headers["set-cookie"])).not.toContain(
        `${ACCESS_COOKIE}=ey`,
      );
    });

    it("answers a wrong password the ordinary way", async () => {
      const reviewer = await createMember({ isTestUser: true });

      await login(reviewer.email, "wrong").expect(401);
    });

    it("signs an ordinary account in", async () => {
      const member = await createMember();

      await login(member.email).expect(200);
    });

    it("ends the open sessions of an account flagged in the database", async () => {
      const member = await createMember();
      const { access_token, refresh_token } = (await login(member.email)).body;
      await me(access_token).expect(200);

      await userRepo.update(member.id, { isTestUser: true });

      await me(access_token).expect(401);
      await request(server())
        .post("/auth/refresh?mode=header")
        .set("Authorization", `Bearer ${refresh_token}`)
        .expect(401);
    });

    it("refuses a review account's socket handshake", async () => {
      const reviewer = await createMember({ isTestUser: true });
      const socket = io(`${url}/messaging`, {
        auth: { token: signAccessToken(ctx.jwtService, reviewer) },
        transports: ["websocket"],
        reconnection: false,
      });
      const refusal = await new Promise<Error>((resolve, reject) => {
        socket.on("connect", () => reject(new Error("connected")));
        socket.on("connect_error", resolve);
      });
      socket.close();

      expect(refusal.message).toBe("Unauthorized");
    });

    it("refuses a password reset for a review account", async () => {
      const reviewer = await createMember({ isTestUser: true });
      const token = await ctx.app
        .get(UserService)
        .generatePasswordResetToken(reviewer.id);

      await request(server())
        .post("/auth/reset-password")
        .send({ token, password: "changed-password" })
        .expect(401);
      runningAs(NodeEnv.Staging);
      await login(reviewer.email).expect(200);
    });

    it("refuses a review account's provider sign-in before linking it", async () => {
      const reviewer = await createMember({
        isTestUser: true,
        emailVerified: true,
      });

      const signedIn = await ctx.app.get(OAuthAuthService).signIn({
        provider: OAuthProvider.Google,
        subject: `review-subject-${reviewer.id}`,
        email: reviewer.email,
        emailVerified: true,
        name: null,
      });

      expect(signedIn).toEqual(R.failure(OAuthError.ReviewAccount));
      const linked = await userRepo.findOneOrFail({
        where: { id: reviewer.id },
        relations: { oauthAccounts: true },
      });
      expect(linked.oauthAccounts).toEqual([]);
    });

    it("refuses a review account's sign-in through a provider it already linked", async () => {
      const reviewer = await createMember({
        isTestUser: true,
        emailVerified: true,
      });
      const profile = {
        provider: OAuthProvider.Google,
        subject: `review-subject-${reviewer.id}`,
        email: reviewer.email,
        emailVerified: true,
        name: null,
      };
      const oauth = ctx.app.get(OAuthAuthService);
      runningAs(NodeEnv.Staging);
      expect((await oauth.signIn(profile)).ok).toBe(true);
      runningAs(NodeEnv.Production);

      expect(await oauth.signIn(profile)).toEqual(
        R.failure(OAuthError.ReviewAccount),
      );
    });

    it("refuses a provider handoff redeemed after the account was flagged", async () => {
      const member = await createMember();
      const oauth = ctx.app.get(OAuthAuthService);
      const { proof, proofHash } = mintProof();
      const token = await oauth.signHandoff({
        userId: member.id,
        provider: OAuthProvider.Google,
        outcome: OAuthOutcome.SignedIn,
        proofHash,
        sessionGeneration: member.sessionGeneration,
      });

      await userRepo.update(member.id, { isTestUser: true });

      expect(
        await oauth.redeemHandoff({
          token,
          proof,
          provider: OAuthProvider.Google,
        }),
      ).toEqual(R.failure(OAuthError.Failed));
    });

    it("sends no password reset email to a review account", async () => {
      const reviewer = await createMember({ isTestUser: true });
      const send = jest.spyOn(
        ctx.app.get(MailService),
        "sendPasswordResetEmail",
      );
      try {
        await request(server())
          .post("/auth/forgot-password")
          .send({ email: reviewer.email })
          .expect(200);

        expect(send).not.toHaveBeenCalled();
      } finally {
        send.mockRestore();
      }
    });

    it("refuses to impersonate a review account", async () => {
      const reviewer = await createMember({ isTestUser: true });

      const res = await request(server())
        .get(`/auth/impersonate/${reviewer.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(403);

      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("refuses the staging handoff", async () => {
      const reviewer = await createMember({ isTestUser: true });

      const res = await reviewLogin(reviewer.email).expect(303);

      expect(res.headers.location).toContain(
        `${REVIEW_SIGN_IN_FAILED_PARAM}=1`,
      );
      expect(res.headers["set-cookie"]).toBeUndefined();
    });
  });

  describe("on staging", () => {
    beforeEach(() => runningAs(NodeEnv.Staging));

    it("signs a review account in with its password", async () => {
      const reviewer = await createMember({ isTestUser: true });

      const { access_token } = (await login(reviewer.email).expect(200)).body;

      await me(access_token).expect(200);
    });

    it("hands a review account from production's web login to a cookie session", async () => {
      const reviewer = await createMember({ isTestUser: true });

      const res = await reviewLogin(reviewer.email).expect(303);

      expect(res.headers.location).toBe(`${process.env.APP_URL}/tasks`);
      const cookies = String(res.headers["set-cookie"]);
      expect(cookies).toContain(`${ACCESS_COOKIE}=ey`);
      expect(cookies).toContain(`${REFRESH_COOKIE}=ey`);
    });

    it("records the handoff as a login", async () => {
      const reviewer = await createMember({ isTestUser: true });
      const capture = jest.spyOn(ctx.app.get(PosthogService), "capture");

      await reviewLogin(reviewer.email).expect(303);

      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AnalyticsEvent.Login,
          distinctId: String(reviewer.id),
        }),
      );
    });

    it.each([
      ["an ordinary account", { isTestUser: false }, PASSWORD],
      ["a wrong password", { isTestUser: true }, "wrong"],
    ])(
      "sends the handoff of %s back to the login page",
      async (_name, overrides, password) => {
        const member = await createMember(overrides);

        const res = await reviewLogin(member.email, password).expect(303);

        expect(res.headers.location).toBe(
          `${process.env.APP_URL}/login?${REVIEW_SIGN_IN_FAILED_PARAM}=1`,
        );
        expect(res.headers["set-cookie"]).toBeUndefined();
      },
    );

    it("logs a broken account lookup and sends the handoff back to the login page", async () => {
      jest
        .spyOn(ctx.app.get(UserService), "findOneByEmail")
        .mockRejectedValue(new Error("database unavailable"));
      const logged = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await reviewLogin("review@example.com").expect(303);

      expect(res.headers.location).toBe(
        `${process.env.APP_URL}/login?${REVIEW_SIGN_IN_FAILED_PARAM}=1`,
      );
      expect(logged).toHaveBeenCalledWith(
        "review sign-in failed",
        expect.stringContaining("database unavailable"),
      );
    });
  });
});
