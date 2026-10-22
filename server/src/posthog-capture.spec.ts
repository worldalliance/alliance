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

  it.each([
    { contentType: "application/json", body: "{invalid-json", status: 400 },
    { contentType: "application/json; charset=bogus", body: "{}", status: 415 },
  ])(
    "captures a body-parser $status once, with that status",
    async ({ contentType, body, status }) => {
      const events: { event: string; status: unknown }[] = [];
      const posthog = new PostHog("test-key", {
        flushAt: 1,
        disableCompression: true,
        fetchRetryCount: 0,
        fetch: async (_url, options) => {
          const payload: {
            batch?: { event: string; properties: { status?: unknown } }[];
          } = JSON.parse(await new Response(options.body).text());
          events.push(
            ...(payload.batch ?? []).map(({ event, properties }) => ({
              event,
              status: properties.status,
            })),
          );
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
        .set("Content-Type", contentType)
        .send(body)
        .expect(status);
      await posthog.shutdown();
      await app.close();

      expect(events).toEqual([{ event: "$exception", status }]);
    },
  );
});
