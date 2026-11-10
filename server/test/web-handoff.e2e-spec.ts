import { KORA_REVIEW_PATH } from "@alliance/common/kora";
import { setEnv } from "@alliance/common/set-env";
import { WebHandoff } from "src/auth/entities/web-handoff.entity";
import { sitePath } from "src/auth/web-handoff.service";
import { hashToken } from "src/utils/random";
import request from "supertest";
import { createTestApp, type TestContext } from "./e2e-test-utils";

const APP_URL = "https://app.example.org";

describe("Web handoff (e2e)", () => {
  let ctx: TestContext;
  const previousAppUrl = process.env.APP_URL;

  const server = () => request(ctx.app.getHttpServer());
  const newCode = async (token = ctx.accessToken) =>
    (
      await server()
        .post("/auth/web-handoff")
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
    ).body.code as string;
  const redeem = (code: string, next = KORA_REVIEW_PATH) =>
    server().get("/auth/web-handoff/redeem").query({ code, next }).expect(302);
  const sessionCookies = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers["set-cookie"] ?? [])
      .filter((c) => /^(access_token|refresh_token)=[^;]+/.test(c));

  beforeAll(async () => {
    process.env.APP_URL = APP_URL;
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    setEnv("APP_URL", previousAppUrl);
    await ctx.app.close();
  });

  it("signs the member in on the web and lands on the requested page", async () => {
    const res = await redeem(await newCode());
    expect(res.headers.location).toBe(`${APP_URL}${KORA_REVIEW_PATH}`);
    expect(
      sessionCookies(res)
        .map((c) => c.split("=")[0])
        .sort(),
    ).toEqual(["access_token", "refresh_token"]);
  });

  it("works once only", async () => {
    const code = await newCode();
    await redeem(code);
    const again = await redeem(code);
    expect(sessionCookies(again)).toEqual([]);
    expect(again.headers.location).toBe(`${APP_URL}${KORA_REVIEW_PATH}`);
  });

  it("does nothing once expired", async () => {
    const code = await newCode();
    await ctx.dataSource
      .getRepository(WebHandoff)
      .update(
        { codeHash: hashToken(code) },
        { expiresAt: new Date(Date.now() - 1000) },
      );
    expect(sessionCookies(await redeem(code))).toEqual([]);
  });

  it("is only issued to a signed-in member", async () => {
    await server().post("/auth/web-handoff").expect(401);
  });

  it("never redirects off the site", async () => {
    const res = await redeem(await newCode(), "//evil.example.com/x");
    expect(res.headers.location).toBe(`${APP_URL}/`);
  });
});

describe("sitePath", () => {
  it("keeps site paths and refuses anything that could leave the site", () => {
    expect(sitePath("/projects/x/review?y=1", "/")).toBe(
      "/projects/x/review?y=1",
    );
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "evil",
      undefined,
      3,
    ]) {
      expect(sitePath(bad, "/")).toBe("/");
    }
  });
});
