import { Controller, Post } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ApiResponse } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { PostHog } from "posthog-node";
import request from "supertest";
import { capturePosthogExceptions } from "./posthog.filter";
import { configureApp } from "./utils/configure-app";

describe("PostHog exception capture", () => {
  // eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered by Test.createTestingModule below.
  @Controller("capture-test")
  class TestController {
    @Post()
    @ApiResponse({ status: 201 })
    accept(): void {}
  }

  it("captures a malformed request body once", async () => {
    const events: string[] = [];
    const posthog = new PostHog("test-key", {
      flushAt: 1,
      disableCompression: true,
      fetchRetryCount: 0,
      fetch: async (_url, options) => {
        const body: { batch?: { event: string }[] } = JSON.parse(
          await new Response(options.body).text(),
        );
        events.push(...(body.batch ?? []).map(({ event }) => event));
        return { status: 200, text: async () => "", json: async () => ({}) };
      },
    });
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();
    const app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    capturePosthogExceptions(app, posthog);
    await app.init();

    await request(app.getHttpServer())
      .post("/capture-test")
      .set("Content-Type", "application/json")
      .send("{invalid-json")
      .expect(400);
    await posthog.shutdown();
    await app.close();

    expect(events).toEqual(["$exception"]);
  });
});
