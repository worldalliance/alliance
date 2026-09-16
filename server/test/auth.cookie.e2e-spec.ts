import { ACCOUNT_MOVED_MESSAGE } from "@alliance/common/url";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import TestAgent from "supertest/lib/agent";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Auth via Http-Only cookies (e2e)", () => {
  let ctx: TestContext;
  let referralCode: string;

  beforeAll(async () => {
    ctx = await createTestApp([]);

    const referrer = await ctx.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: ctx.testUserId });
    referralCode = referrer.referralCode;

    await ctx.agent
      .post("/auth/register")
      .send({
        email: "newuser@test.com",
        password: "password",
        name: "Cookie Tester",
        mode: "cookie",
        timeZone: "America/Los_Angeles",
        referralCode,
      })
      .expect(201);
  }, 50000);

  it("rejects invalid login", async () => {
    await ctx.agent
      .post("/auth/login")
      .send({ email: "nobody@test.com", password: "password", mode: "cookie" })
      .expect(401);
  });

  it("registers a new user", async () => {
    await ctx.agent
      .post("/auth/register")
      .send({
        email: "newuser2@test.com",
        password: "password",
        name: "Cookie Tester",
        mode: "cookie",
        timeZone: "America/Los_Angeles",
        referralCode,
      })
      .expect(201);
  });

  it("user can login", async () => {
    await ctx.agent
      .post("/auth/login")
      .send({
        email: "newuser@test.com",
        password: "password",
        mode: "cookie",
      })
      .expect(200);
  });

  it("logged in user can get profile", async () => {
    await ctx.agent.get("/auth/me").expect(200);
  });

  describe("a request carrying both", () => {
    let adminAgent: TestAgent;

    beforeAll(async () => {
      adminAgent = request.agent(ctx.app.getHttpServer());
      await adminAgent.post("/auth/admin/login").send({
        email: "admin@example.com",
        password: "pass",
        mode: "cookie",
      });
    });

    it("admits the cookie on its own", async () => {
      await adminAgent.get("/user/tags").expect(200);
    });

    it("prefers the header, so a junk Bearer beats a valid cookie", async () => {
      await adminAgent
        .get("/user/tags")
        .set("Authorization", "Bearer junk")
        .expect(401);
    });

    it("keeps the cookie under another scheme", async () => {
      await adminAgent
        .get("/user/tags")
        .set("Authorization", "Basic junk")
        .expect(200);
    });

    it("keeps the cookie under a Bearer with nothing after it", async () => {
      await adminAgent
        .get("/user/tags")
        .set("Authorization", "Bearer")
        .expect(200);
    });

    it("admits the cookie on an optional-auth route", async () => {
      await ctx.agent.get("/forum/posts/1/comments").expect(200);
    });

    it("refuses an optional-auth route under a junk Bearer", async () => {
      await ctx.agent
        .get("/forum/posts/1/comments")
        .set("Authorization", "Bearer junk")
        .expect(401);
    });
  });

  describe("a member who moved to the new domain", () => {
    const login = (host: string, mode: string) =>
      request(ctx.app.getHttpServer())
        .post("/auth/login")
        .set("Host", host)
        .send({ email: "user@example.com", password: "pass", mode });

    beforeAll(async () => {
      await ctx.dataSource
        .getRepository(User)
        .update(
          { email: "user@example.com" },
          { switchedDomainAt: new Date() },
        );
    });

    afterAll(async () => {
      await ctx.dataSource
        .getRepository(User)
        .update({ email: "user@example.com" }, { switchedDomainAt: null });
    });

    it("is refused a cookie session on the legacy domain", async () => {
      const res = await login("worldalliance.org", "cookie").expect(409);

      expect(res.body.message).toBe(ACCOUNT_MOVED_MESSAGE);
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("is refused on a legacy host carrying a port", async () => {
      await login("worldalliance.org:3005", "cookie").expect(409);
    });

    it("signs in on the new domain", async () => {
      await login("thealliance.org", "cookie").expect(200);
    });

    it("signs in from the mobile app, which never crosses domains", async () => {
      await login("worldalliance.org", "header").expect(200);
    });
  });

  describe("refresh flow", () => {
    it("allows refresh with valid cookie", async () => {
      await ctx.agent.post("/auth/refresh").expect(200);
    });

    it("rejects refresh with invalid cookie", async () => {
      await request(ctx.app.getHttpServer()).post("/auth/refresh").expect(401);
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
