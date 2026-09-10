import request from "supertest";
import TestAgent from "supertest/lib/agent";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Auth via Http-Only cookies (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);

    await ctx.agent.post("/auth/register").send({
      email: "newuser@test.com",
      password: "password",
      name: "Cookie Tester",
      mode: "cookie",
      timeZone: "America/Los_Angeles",
    });
  }, 50000);

  it("rejects invalid login", () => {
    return ctx.agent
      .post("/auth/login")
      .send({ email: "nobody@test.com", password: "password", mode: "cookie" })
      .expect(401);
  });

  it("registers a new user", () => {
    return ctx.agent
      .post("/auth/register")
      .send({
        email: "newuser2@test.com",
        password: "password",
        name: "Cookie Tester",
        mode: "cookie",
        timeZone: "America/Los_Angeles",
      })
      .expect(201);
  });

  it("user can login", () => {
    const loginResponse = ctx.agent.post("/auth/login").send({
      email: "newuser@test.com",
      password: "password",
      mode: "cookie",
    });

    loginResponse.expect(200);
  });

  it("logged in user can get profile", () => {
    return ctx.agent.get("/auth/me").expect(200);
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

  describe("refresh flow", () => {
    it("allows refresh with valid cookie", () => {
      return ctx.agent.post("/auth/refresh").expect(200);
    });

    it("rejects refresh with invalid cookie", () => {
      return request(ctx.app.getHttpServer()).post("/auth/refresh").expect(401);
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
