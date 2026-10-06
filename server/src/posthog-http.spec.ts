import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  POSTHOG_DISTINCT_HEADER,
  POSTHOG_SESSION_HEADER,
} from "@alliance/common/posthog";
import { BadRequestException, Controller, Post } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ApiResponse } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { PostHog } from "posthog-node";
import request from "supertest";
import { capturePosthogExceptions } from "./posthog.filter";
import { configureApp } from "./utils/configure-app";
import { captureEvent } from "./utils/posthog";

describe("HTTP request to PostHog payload", () => {
  let app: NestExpressApplication;
  let posthog: PostHog;
  const payloads: unknown[] = [];
  let onPayload = () => {};
  const sessionId = "01900000-0000-7000-8000-000000000001";

  // eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered by Test.createTestingModule below.
  @Controller("telemetry-test")
  class TestController {
    @Post("event")
    @ApiResponse({ status: 201 })
    event(): void {
      captureEvent({
        client: posthog,
        event: AnalyticsEvent.ActionCompleted,
        distinctId: "7",
      });
    }

    @Post("error")
    @ApiResponse({ status: 400 })
    error(): void {
      throw new BadRequestException("Start date must be in the future.");
    }
  }

  beforeAll(async () => {
    posthog = new PostHog("test-key", {
      flushInterval: 0,
      flushAt: 1,
      disableCompression: true,
      fetchRetryCount: 0,
      fetch: async (_url, options) => {
        if (options.body) {
          payloads.push(JSON.parse(await new Response(options.body).text()));
          onPayload();
        }
        return { status: 200, text: async () => "", json: async () => ({}) };
      },
    });
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    capturePosthogExceptions(app, posthog);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await posthog.shutdown();
  });

  beforeEach(() => {
    payloads.length = 0;
  });

  it.each([
    {
      path: "event",
      body: "{}",
      status: 201,
      event: AnalyticsEvent.ActionCompleted,
      distinctId: "7",
    },
    {
      path: "error",
      body: "{}",
      status: 400,
      event: "$exception",
      distinctId: "anonymous-browser",
    },
    {
      path: "event",
      body: "{invalid-json",
      status: 400,
      event: "$exception",
      distinctId: "anonymous-browser",
    },
  ])(
    "links $path ($status) in the SDK's outgoing payload",
    async (testCase) => {
      const received = new Promise<void>((resolve) => {
        onPayload = resolve;
      });
      await request(app.getHttpServer())
        .post(`/telemetry-test/${testCase.path}`)
        .set(POSTHOG_SESSION_HEADER, sessionId)
        .set(POSTHOG_DISTINCT_HEADER, "anonymous-browser")
        .set("Content-Type", "application/json")
        .send(testCase.body)
        .expect(testCase.status);
      await received;
      expect(payloads).toEqual([
        expect.objectContaining({
          batch: [
            expect.objectContaining({
              event: testCase.event,
              distinct_id: testCase.distinctId,
              properties: expect.objectContaining({ $session_id: sessionId }),
            }),
          ],
        }),
      ]);
    },
  );
});
