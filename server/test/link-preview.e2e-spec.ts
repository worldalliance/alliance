import { Global, Module } from "@nestjs/common";
import { LINK_PREVIEW_THROTTLE } from "src/link-preview/link-preview-throttle.config";
import {
  makeTransport,
  PAGE_HTML,
  PNG_BYTES,
  response,
} from "src/link-preview/link-preview.fixtures";
import { LinkPreviewModule } from "src/link-preview/link-preview.module";
import { LINK_PREVIEW_TRANSPORT } from "src/link-preview/link-preview.service";
import request from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

// Pins the endpoint end to end: auth-only access, rejection of URLs the
// SSRF-guarded fetcher would never attempt, the 200 path through the real
// controller/service wiring (including the DTO dropping null fields from
// the JSON), and the per-user rate limit. No test makes a real outbound
// fetch — the happy path runs against a fake transport, injected via the
// same LINK_PREVIEW_TRANSPORT seam the unit tests use.

const { transport: fakeTransport } = makeTransport((url) => {
  // A host with no metadata and no favicon — every preview field ends up
  // null, which the DTO must drop from the JSON body entirely.
  if (url.hostname === "no-meta.test") {
    return url.pathname === "/"
      ? response("<html><body>plain</body></html>")
      : response("not found", {}, 404);
  }
  if (url.pathname === "/fav.png") {
    return response(PNG_BYTES, { "content-type": "image/png" });
  }
  return response(PAGE_HTML);
});

// The transport token is optional and unprovided in production (the service
// falls back to real DNS + HTTP), so there is nothing for Nest's
// overrideProvider to replace — a global module is how the fake reaches
// LinkPreviewService's injector.
@Global()
@Module({
  providers: [{ provide: LINK_PREVIEW_TRANSPORT, useValue: fakeTransport }],
  exports: [LINK_PREVIEW_TRANSPORT],
})
class FakeTransportModule {}

describe("Link preview (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([FakeTransportModule, LinkPreviewModule]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const getPreview = (query: string, token?: string) => {
    const req = request(ctx.app.getHttpServer()).get(`/link-preview${query}`);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  };

  it("rejects anonymous requests with 401", async () => {
    const res = await getPreview("?url=https://example.com");
    expect(res.status).toBe(401);
  });

  it("rejects a missing url param with 400", async () => {
    const res = await getPreview("", ctx.accessToken);
    expect(res.status).toBe(400);
  });

  // The 400 message names the rejecting rule — "not a URL" and "valid URL
  // we refuse on principle" are different caller mistakes.
  it("rejects non-http(s) and malformed urls with a per-cause 400", async () => {
    const cases: Array<[string, string]> = [
      ["not-a-url", "url must be a valid absolute URL"],
      ["file:///etc/passwd", "url must use http or https"],
      ["ftp://x.com/a", "url must use http or https"],
    ];
    for (const [url, message] of cases) {
      const res = await getPreview(
        `?url=${encodeURIComponent(url)}`,
        ctx.accessToken,
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(message);
    }
  });

  // Every accepted URL becomes an in-memory cache key, so the DTO bounds
  // the length up front instead of relying on Node's header-size cap.
  it("rejects over-long urls with 400", async () => {
    const longUrl = `https://example.com/${"a".repeat(2100)}`;
    const res = await getPreview(
      `?url=${encodeURIComponent(longUrl)}`,
      ctx.accessToken,
    );
    expect(res.status).toBe(400);
    // ValidationPipe failures carry an array of messages, one per rule.
    expect(res.body.message).toEqual([
      "url must be shorter than or equal to 2048 characters",
    ]);
  });

  it("rejects urls with non-default ports with 400", async () => {
    const res = await getPreview(
      `?url=${encodeURIComponent("http://example.com:8080/x")}`,
      ctx.accessToken,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("url must not specify a non-default port");
  });

  it("returns the full preview for an authenticated request", async () => {
    const res = await getPreview(
      `?url=${encodeURIComponent("https://example.com/article")}`,
      ctx.accessToken,
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: "https://example.com/article",
      title: "Example Title",
      description: "Example description.",
      siteName: "Example Site",
      faviconDataUri: `data:image/png;base64,${PNG_BYTES.toString("base64")}`,
    });
  });

  it("omits null fields from the JSON body instead of serializing them", async () => {
    const res = await getPreview(
      `?url=${encodeURIComponent("https://no-meta.test/")}`,
      ctx.accessToken,
    );

    expect(res.status).toBe(200);
    // toEqual pins the exact shape: no title/description/siteName/
    // faviconDataUri keys at all, rather than keys explicitly set to null.
    expect(res.body).toEqual({ url: "https://no-meta.test/" });
  });

  // UserThrottlerGuard is not the ThrottlerGuard token that createTestApp
  // disables by default, so the real per-user limit applies here. Uses the
  // admin token for a fresh throttle bucket — the tests above already spent
  // part of the regular user's budget.
  it("rate limits per user with 429 past the burst limit", async () => {
    const limit = LINK_PREVIEW_THROTTLE.linkPreviewBurst.limit;
    for (let i = 0; i < limit; i++) {
      const res = await getPreview(
        `?url=${encodeURIComponent("https://example.com/article")}`,
        ctx.adminAccessToken,
      );
      expect(res.status).toBe(200);
    }

    const throttled = await getPreview(
      `?url=${encodeURIComponent("https://example.com/article")}`,
      ctx.adminAccessToken,
    );
    expect(throttled.status).toBe(429);
  });
});
