import { setEnv } from "@alliance/common/set-env";
import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, expect, it } from "bun:test";
import { assetsBucket } from "./assets-bucket";

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  ASSETS_BUCKET: process.env.ASSETS_BUCKET,
  ALLIANCE_WITHOUT_TEAM_SECRETS: process.env.ALLIANCE_WITHOUT_TEAM_SECRETS,
};
afterEach(() => {
  for (const [key, value] of Object.entries(saved)) setEnv(key, value);
});

function bucketWith(env: { NODE_ENV: string; flag?: string }) {
  setEnv("NODE_ENV", env.NODE_ENV);
  setEnv("ASSETS_BUCKET", "bucket");
  setEnv("ALLIANCE_WITHOUT_TEAM_SECRETS", env.flag);
  return () => assetsBucket();
}

it("names the bucket", () => {
  expect(bucketWith({ NODE_ENV: "development" })()).toBe("bucket");
});

it("answers 503 in development without the team's secrets", () => {
  expect(bucketWith({ NODE_ENV: "development", flag: "1" })).toThrow(
    ServiceUnavailableException,
  );
});

it("ignores the flag outside development, so e2e tests keep their bucket", () => {
  expect(bucketWith({ NODE_ENV: "test", flag: "1" })()).toBe("bucket");
});
