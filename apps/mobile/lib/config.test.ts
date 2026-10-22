import { client } from "@alliance/shared/client/client.gen";
import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import {
  getApiUrl,
  getSiteUrl,
  getWebSocketUrl,
  setReviewSession,
} from "./config";
import { STAGING } from "./releaseTarget";

const originalBaseUrl = client.getConfig().baseUrl;
const originalPort = process.env.EXPO_PUBLIC_ALLIANCE_API_PORT;

beforeAll(() => {
  process.env.EXPO_PUBLIC_ALLIANCE_API_PORT = "4005";
});

afterEach(() => {
  setReviewSession(false);
  client.setConfig({ baseUrl: originalBaseUrl });
});

afterAll(() => {
  process.env.EXPO_PUBLIC_ALLIANCE_API_PORT = originalPort;
});

it("points every deployment URL at staging during a review session", () => {
  setReviewSession(true);

  expect(getApiUrl()).toBe(STAGING.apiUrl);
  expect(client.getConfig().baseUrl).toBe(STAGING.apiUrl);
  expect(getSiteUrl()).toBe(STAGING.siteUrl);
  expect(getWebSocketUrl()).toBe("wss://staging.worldalliance.org");
});

it("returns to the binary's deployment once the review session ends", () => {
  setReviewSession(true);
  setReviewSession(false);

  expect(getApiUrl()).toBe("http://localhost:4005");
  expect(client.getConfig().baseUrl).toBe("http://localhost:4005");
  expect(getSiteUrl()).toBe("http://localhost:4005");
  expect(getWebSocketUrl()).toBe("ws://localhost:4005");
});
