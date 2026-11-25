import { setEnv } from "@alliance/common/set-env";
import { afterAll, beforeAll, expect, it } from "bun:test";
import { profileImageUri } from "./profileImageUri";

const originalPort = process.env.EXPO_PUBLIC_ALLIANCE_API_PORT;
beforeAll(() => {
  process.env.EXPO_PUBLIC_ALLIANCE_API_PORT = "4005";
});
afterAll(() => {
  setEnv("EXPO_PUBLIC_ALLIANCE_API_PORT", originalPort);
});

const key = "1770255651460-0b6d4a3e-8f1c-4c2a-9d7e-5a6b7c8d9e0f.webp";

it("loads a bare upload key's thumbnail at a thumbnail size", () => {
  expect(profileImageUri(key, "small")).toBe(
    "http://localhost:4005/images/1770255651460-0b6d4a3e-8f1c-4c2a-9d7e-5a6b7c8d9e0f-128.webp",
  );
});

it("loads a bare upload key in full at huge", () => {
  expect(profileImageUri(key, "huge")).toBe(
    `http://localhost:4005/images/${key}`,
  );
});

it("leaves an external url alone", () => {
  const url = "https://example.org/me.png";
  expect(profileImageUri(url, "small")).toBe(url);
});

it("loads a dev server's localhost url's thumbnail from the device-reachable api", () => {
  expect(profileImageUri(`http://localhost:4905/images/${key}`, "small")).toBe(
    "http://localhost:4005/images/1770255651460-0b6d4a3e-8f1c-4c2a-9d7e-5a6b7c8d9e0f-128.webp",
  );
});
